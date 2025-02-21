const express = require("express");
const amqp = require("amqplib");

const app = express();
app.use(express.json());

const PORT = 4000;
const RABBITMQ_URL = "amqp://rabbitmq";
const QUEUE_NAME = "inventory_queue";
const EXCHANGE_NAME = "stock_exchange";
const ROUTING_KEY = "stock.update";

const inventory = {
  item1: 10,
  item2: 5,
};

let channel, connection;

// Function to publish stock updates
async function publishStockUpdate(item_id, available) {
  try {
    if (!channel) {
      console.error("❌ Cannot publish - RabbitMQ channel is not connected!");
      return;
    }

    const message = JSON.stringify({ item_id, available });
    channel.publish(EXCHANGE_NAME, ROUTING_KEY, Buffer.from(message));
    console.log(`📢 Published stock update: ${message}`);
  } catch (error) {
    console.error("❌ Error publishing stock update:", error);
  }
}

// Function to connect to RabbitMQ
async function connectRabbitMQ() {
  let retries = 3;
  while (retries > 0) {
    try {
      console.log("🔄 Connecting to RabbitMQ...");
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();

      await channel.assertQueue(QUEUE_NAME, { durable: true });
      await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: false });

      console.log(`✅ Listening for messages on ${QUEUE_NAME}...`);

      channel.consume(QUEUE_NAME, async (msg) => {
        if (msg) {
          console.log("📩 Received message:", msg.content.toString());
          const { item_id, quantity } = JSON.parse(msg.content.toString());

          if (inventory[item_id] !== undefined) {
            if (inventory[item_id] >= quantity) {
              inventory[item_id] -= quantity;
              console.log(
                `✅ Stock updated: ${item_id} → ${inventory[item_id]} left`
              );
              await publishStockUpdate(item_id, inventory[item_id] > 0);
            } else {
              console.error(
                `❌ Not enough stock for ${item_id}. Requested: ${quantity}, Available: ${inventory[item_id]}`
              );
            }
          } else {
            console.error(`❌ Item ${item_id} not found in inventory.`);
          }

          channel.ack(msg);
        }
      });

      console.log("✅ Inventory Service connected to RabbitMQ.");
      return;
    } catch (error) {
      console.error("❌ RabbitMQ connection error:", error);
      retries -= 1;
      console.log(`Retries left: ${retries}`);
      if (retries === 0) {
        console.error(
          "❌ Failed to connect to RabbitMQ after multiple attempts."
        );
        process.exit(1);
      }
      await new Promise((res) => setTimeout(res, 5000)); // Wait before retrying
    }
  }
}

// API route to check item availability
app.get("/check-availability", (req, res) => {
  const { itemId } = req.query;
  const available = inventory[itemId] > 0;
  if (itemId in inventory) {
    return res.status(200).json({ itemId, available });
  } else {
    return res
      .status(400)
      .json({ message: "❌ Item is not in inventory list or out of stock" });
  }
});

// Start server and connect to RabbitMQ
app.listen(PORT, () => {
  console.log(`🚀 Inventory Service running on port ${PORT}`);
  connectRabbitMQ();
});
