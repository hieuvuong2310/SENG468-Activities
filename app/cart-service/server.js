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
const ROUTING_KEY = "stock.update";
const orderResponses = {};
const RABBITMQ_URL = "amqp://rabbitmq"
;
const INVENTORY_SERVICE_URL =
  "http://inventory-service:4000/check-availability";

// New queue for order confirmations
const CART_UPDATE_QUEUE = "cart_updates";

// Circuit Breaker states
const circuitBreaker = {
  state: "CLOSED", // Possible states: CLOSED, OPEN, HALF-OPEN
  failureCount: 0,
  successCount: 0,
  threshold: 3,
  resetTimeout: 10000, // 10 seconds
};

const availabilityCache = {};

async function connectRabbitMQ(retries = 3) {
  while (retries > 0) {
    try {
      console.log("🔄 Connecting to RabbitMQ...");
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
       console.log("Delete queue");
      //  await channel.deleteQueue(INVENTORY_QUEUE);
      //  await channel.deleteQueue(CART_UPDATE_QUEUE);
       console.log("✅ Queue deleted successfully!");

      await channel.assertQueue(INVENTORY_QUEUE, { durable: true });
      await channel.assertQueue("cart_updates", { durable: true }); // Listening for updates
      await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: false });

      console.log("✅ Connected to RabbitMQ!");

      
      // Listen for inventory updates (stock changes)
      channel.consume(INVENTORY_QUEUE, (msg) => {
        if (msg) {
          const response = JSON.parse(msg.content.toString());
          console.log(`📩 Stock Update Received:`, response);
          // channel.ack(msg);
        }
      });

      // Listen for order confirmations from Inventory Service
      channel.consume(CART_UPDATE_QUEUE, (msg) => {
        if (msg) {
          const response = JSON.parse(msg.content.toString());
          console.log(`📦 Order Confirmation Received:`, response);

          if (orderResponses[response.itemId]) {
            orderResponses[response.itemId](
              response.success,
              response.remaining_stock
            );
            delete orderResponses[response.itemId]; // Clean up
            // once done, delete in the queue as well
          }
          channel.ack(msg);
        }
      });

      return; // Exit the function if connection is successful
    } catch (error) {
      console.error("❌ RabbitMQ Connection Error:", error);
      retries -= 1;
      console.log(`Retries left: ${retries}`);
      if (retries === 0) {
        console.error("Failed to connect to RabbitMQ after multiple attempts.");
        process.exit(1); // Exit the process if unable to connect
      }
      await new Promise((res) => setTimeout(res, 5000)); // Wait for 5 seconds before retrying
    }
  }
}


function updateCircuitBreaker(success) {
  if (circuitBreaker.state === "OPEN") return;

  if (success) {
    circuitBreaker.successCount++;
    circuitBreaker.failureCount = 0;
    if (
      circuitBreaker.state === "HALF-OPEN" &&
      circuitBreaker.successCount >= 2
    ) {
      circuitBreaker.state = "CLOSED";
      console.log("✅ Circuit Breaker transitioned to CLOSED state.");
    }
  } else {
    circuitBreaker.failureCount++;
    if (circuitBreaker.failureCount >= circuitBreaker.threshold) {
      circuitBreaker.state = "OPEN";
      console.log("⛔ Circuit Breaker transitioned to OPEN state.");
      setTimeout(() => {
        circuitBreaker.state = "HALF-OPEN";
        circuitBreaker.successCount = 0;
        console.log("🔄 Circuit Breaker transitioned to HALF-OPEN state.");
      }, circuitBreaker.resetTimeout);
    }
  }
}

app.post("/add-to-cart", async (req, res) => {
  const { itemId, quantity } = req.body;

  if (!channel) {
    return res
      .status(500)
      .json({ message: "❌ RabbitMQ channel not available!" });
  }

  const order = { itemId, quantity };
  channel.sendToQueue(INVENTORY_QUEUE, Buffer.from(JSON.stringify(order)), {
    persistent: true,
  });

  console.log(`📤 Sent order request: ${JSON.stringify(order)}`);

  // Store response handler
  let handled = false;
  orderResponses[itemId] = (success, remaining_stock) => {
    if (handled) return;
    handled = true;

    console.log(`📦 Order response received for ${itemId}: ${success}`);
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

  // Timeout to prevent API Gateway from waiting forever
  setTimeout(() => {
    if (!handled) {
      handled = true;
      res.status(500).json({
        message: `⏳ Timeout: No response received for ${itemId}`,
      });
      delete orderResponses[itemId];
    }
  }, 5000); // Adjust timeout as needed
});


app.listen(PORT, async () => {
  console.log(`Cart Service running on port ${PORT}`);
  await connectRabbitMQ();
});
