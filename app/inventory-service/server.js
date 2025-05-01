const express = require("express");
const amqp = require("amqplib");

const app = express();
app.use(express.json());

const PORT = 4000;
const RABBITMQ_URL = "amqp://rabbitmq";
const INVENTORY_QUEUE = "inventory_queue";
const CART_UPDATE_QUEUE = "cart_updates";

const inventory = {
  item1: 10,
  item2: 5,
};

let channel, connection;

// Function to simulate random delays (up to 5 seconds)
function randomDelay() {
  return new Promise((resolve) => {
    const delay = Math.floor(Math.random() * 5000); // Random delay (0-5000ms)
    console.log(`⏳ Simulating delay of ${delay}ms...`);
    setTimeout(resolve, delay);
  });
}

// Function to simulate random failures
function randomFailure() {
  return Math.random() < 0.5; // 100% chance of failure
}

// Function to send order confirmation back to Cart Service
async function sendOrderConfirmation(itemId, success, remaining_stock) {
  try {
    if (!channel) {
      console.error(
        "❌ Cannot send confirmation - RabbitMQ channel is not connected!"
      );
      return;
    }

    const message = JSON.stringify({ itemId, success, remaining_stock });
    channel.sendToQueue(CART_UPDATE_QUEUE, Buffer.from(message), {
      persistent: true,
    });
    console.log(`📢 Sent order confirmation: ${message}`);
  } catch (error) {
    console.error("❌ Error sending order confirmation:", error);
  }
}

// Function to process orders
async function processOrder(msg) {
  if (!msg) return;

  console.log("📩 Received order request:", msg.content.toString());

  const { itemId, quantity } = JSON.parse(msg.content.toString());

  // **Simulate Failure**
  await randomDelay(); // Add artificial delay

  if (randomFailure()) {
    console.error("💥 Simulated Server Error: Inventory Service is failing!");
    channel.ack(msg);
    return;
  }

  if (inventory[itemId] === undefined) {
    console.error(`❌ Item ${itemId} not found in inventory.`);
    await sendOrderConfirmation(itemId, false, 0);
    channel.ack(msg);
    return;
  }

  if (inventory[itemId] >= quantity) {
    inventory[itemId] -= quantity;
    console.log(`✅ Stock updated: ${itemId} → ${inventory[itemId]} left`);
    await sendOrderConfirmation(itemId, true, inventory[itemId]);
  } else {
    console.error(
      `❌ Not enough stock for ${itemId}. Requested: ${quantity}, Available: ${inventory[itemId]}`
    );
    await sendOrderConfirmation(itemId, false, inventory[itemId]);
  }

  channel.ack(msg);
}

// Function to connect to RabbitMQ
async function connectRabbitMQ(retries = 3) {
  while (retries > 0) {
    try {
      console.log("🔄 Connecting to RabbitMQ...");
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();

      await channel.assertQueue(INVENTORY_QUEUE, { durable: true });
      await channel.assertQueue(CART_UPDATE_QUEUE, { durable: true });

      console.log("✅ Inventory Service connected to RabbitMQ!");

      // Listen for incoming order requests
      channel.consume(INVENTORY_QUEUE, (msg) => processOrder(msg));

      return;
    } catch (error) {
      console.error("❌ RabbitMQ Connection Error:", error);
      retries -= 1;
      console.log(`Retries left: ${retries}`);
      if (retries === 0) {
        console.error("Failed to connect to RabbitMQ after multiple attempts.");
        process.exit(1);
      }
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
}

// Start the Inventory Service
app.listen(PORT, () => {
  console.log(`🚀 Inventory Service running on port ${PORT}`);
  connectRabbitMQ();
});
