const express = require("express");
const amqp = require("amqplib");
const app = express();
const { v4: uuidv4 } = require("uuid");
app.use(express.json());

const PORT = 3000;
const QUEUE_NAME = "order.created";

let channel;

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

async function connectRabbitMQ() {
  const connection = await amqp.connect({
    protocol: "amqp",
    hostname: "rabbitmq",
    port: 5672,
    username: "admin",
    password: "admin",
    vhost: "/",
  });
  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME);
  log("📡 Connected to RabbitMQ");
}

app.post("/placeOrder", async (req, res) => {
  const { amount } = req.body;
  const orderId = uuidv4();
  const event = { orderId, amount };

  log(`📨 Emitting event to ${QUEUE_NAME}: ${JSON.stringify(event)}`);
  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(event)));
  res.send("Order created and event emitted.");
});

app.listen(PORT, async () => {
  await connectRabbitMQ();
  console.log(`🚀 OrderService running on port ${PORT}`);
});
