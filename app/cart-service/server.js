const express = require("express");
const axios = require("axios");
const amqp = require("amqplib");

const app = express();
app.use(express.json());

const PORT = 3000;
const cart = [];
let channel, connection;

const INVENTORY_QUEUE = "inventory_queue";
const EXCHANGE_NAME = "stock_exchange";
const CART_UPDATE_QUEUE = "cart_updates";
const RABBITMQ_URL = "amqp://rabbitmq";

const circuitBreaker = {
  state: "CLOSED", // CLOSED → OPEN → HALF-OPEN → CLOSED
  failureCount: 0,
  successCount: 0,
  threshold: 3, // Number of failures before opening the circuit
  resetTimeout: 10000, // Time to wait before transitioning to HALF-OPEN
  halfOpenTestCount: 2, // Number of successful calls to return to CLOSED
  lastFailureTime: null, // Track last failure
};

// Function to update Circuit Breaker state
function updateCircuitBreaker(success) {
  if (success) {
    circuitBreaker.successCount++;
    circuitBreaker.failureCount = 0;

    if (
      circuitBreaker.state === "HALF-OPEN" &&
      circuitBreaker.successCount >= circuitBreaker.halfOpenTestCount
    ) {
      circuitBreaker.state = "CLOSED";
      console.log("✅ Circuit Breaker transitioned to CLOSED state.");
    }
  } else {
    circuitBreaker.failureCount++;

    if (circuitBreaker.failureCount >= circuitBreaker.threshold) {
      circuitBreaker.state = "OPEN";
      circuitBreaker.lastFailureTime = Date.now();
      console.log("⛔ Circuit Breaker transitioned to OPEN state.");

      setTimeout(() => {
        circuitBreaker.state = "HALF-OPEN";
        circuitBreaker.successCount = 0;
        console.log("🔄 Circuit Breaker transitioned to HALF-OPEN state.");
      }, circuitBreaker.resetTimeout);
    }
  }
}

// Function to check if Circuit Breaker allows requests
function canProceed() {
  if (circuitBreaker.state === "OPEN") {
    const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailureTime;
    if (timeSinceLastFailure >= circuitBreaker.resetTimeout) {
      circuitBreaker.state = "HALF-OPEN";
      console.log(
        "🔄 Circuit Breaker transitioning to HALF-OPEN state for testing."
      );
      return true;
    }
    return false; // Still in OPEN state
  }
  return true; // Allowed in CLOSED or HALF-OPEN
}

// RabbitMQ connection function
async function connectRabbitMQ(retries = 3) {
  while (retries > 0) {
    try {
      console.log("🔄 Connecting to RabbitMQ...");
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      await channel.assertQueue(INVENTORY_QUEUE, { durable: true });
      await channel.assertQueue(CART_UPDATE_QUEUE, { durable: true });

      console.log("✅ Connected to RabbitMQ!");

      channel.consume(CART_UPDATE_QUEUE, (msg) => {
        if (msg) {
          const response = JSON.parse(msg.content.toString());
          console.log(`📦 Order Confirmation Received:`, response);

          if (orderResponses[response.itemId]) {
            orderResponses[response.itemId](
              response.success,
              response.remaining_stock
            );
            delete orderResponses[response.itemId];
          }
          channel.ack(msg);
        }
      });

      return;
    } catch (error) {
      console.error("❌ RabbitMQ Connection Error:", error);
      retries -= 1;
      if (retries === 0) {
        console.error("Failed to connect to RabbitMQ.");
        process.exit(1);
      }
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
}

// Order storage
const orderResponses = {};

app.post("/add-to-cart", async (req, res) => {
  const { itemId, quantity } = req.body;

  if (!channel) {
    return res
      .status(500)
      .json({ message: "❌ RabbitMQ channel not available!" });
  }

  if (!canProceed()) {
    console.log("⛔ Circuit Breaker is OPEN - rejecting request.");
    return res
      .status(503)
      .json({ message: "⛔ Service unavailable due to repeated failures." });
  }

  try {
    const order = { itemId, quantity };
    channel.sendToQueue(INVENTORY_QUEUE, Buffer.from(JSON.stringify(order)), {
      persistent: true,
    });

    console.log(`📤 Sent order request: ${JSON.stringify(order)}`);

    let handled = false;
    orderResponses[itemId] = (success, remaining_stock) => {
      if (handled) return;
      handled = true;
      updateCircuitBreaker(success);
      if (success) {
        res.json({
          message: `✅ Order confirmed for ${itemId}`,
          remaining_stock,
        });
      } else {
        res
          .status(400)
          .json({ message: `❌ Order failed for ${itemId}`, remaining_stock });
      }
    };

    setTimeout(() => {
      if (!handled) {
        handled = true;
        updateCircuitBreaker(false);
        res
          .status(500)
          .json({ message: `⏳ Timeout: No response received for ${itemId}` });
        delete orderResponses[itemId];
      }
    }, 5000);
  } catch (error) {
    updateCircuitBreaker(false);
    console.error("❌ Error processing request:", error);
    res.status(500).json({ message: "❌ Internal Server Error" });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Cart Service running on port ${PORT}`);
  await connectRabbitMQ();
});
