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
const RABBITMQ_URL = "amqp://rabbitmq";

// In-memory availability cache
const availabilityCache = {};

// Function to connect to RabbitMQ
async function connectRabbitMQ() {
  let retries = 3;
  while (retries > 0) {
    try {
      console.log("Connecting to RabbitMQ...");
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();

      await channel.assertQueue(INVENTORY_QUEUE, { durable: true });
      await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: false });

      console.log("Cart Service connected to RabbitMQ.");

      // Subscribe to stock updates
      const q = await channel.assertQueue("", { exclusive: true });
      await channel.bindQueue(q.queue, EXCHANGE_NAME, ROUTING_KEY);

      channel.consume(
        q.queue,
        (msg) => {
          if (msg !== null) {
            const { item_id, available } = JSON.parse(msg.content.toString());
            availabilityCache[item_id] = available;
            console.log(
              `🔄 Stock updated: ${item_id} → ${
                available ? "In Stock" : "Out of Stock"
              }`
            );
          }
        },
        { noAck: true }
      );

      return;
    } catch (error) {
      console.error("RabbitMQ connection error:", error);
      retries -= 1;
      console.log(`Retries left: ${retries}`);
      if (retries === 0) {
        console.error(
          "Failed to connect to RabbitMQ after multiple attempts."
        );
        process.exit(1);
      }
      await new Promise((res) => setTimeout(res, 5000)); // Wait before retrying
    }
  }
}

// Add to Cart Route
app.post("/add-to-cart", async (req, res) => {
  const { itemId, quantity } = req.body;

  if (!itemId || quantity <= 0) {
    return res.status(400).json({ message: "Invalid item or quantity" });
  }

  try {
    console.log("🛒 Adding item to cart:", itemId);

    // Check availability from cache first
    if (availabilityCache[itemId] === false) {
      return res.status(400).json({ message: "Item is out of stock" });
    }

    // Send message to Inventory Service via RabbitMQ
    const message = JSON.stringify({ item_id: itemId, quantity });
    channel.sendToQueue(INVENTORY_QUEUE, Buffer.from(message));
    console.log("📤 Sent message to Inventory Service:", message);

    // Check availability from Inventory Service
    const response = await axios.get(
      `http://inventory-service:4000/check-availability`,
      { params: { itemId } }
    );

    if (response.data.available) {
      cart.push({ itemId, quantity });
      return res.status(200).json({ message: "Item added to cart", cart });
    } else {
      return res.status(400).json({ message: "Item is out of stock" });
    }
  } catch (error) {
    console.error("Error:", error.message);
    return res
      .status(500)
      .json({ message: "Error communicating with Inventory Service" });
  }
});

// Start server and connect to RabbitMQ
app.listen(PORT, async () => {
  console.log(`Cart Service running on port ${PORT}`);
  await connectRabbitMQ();
});
