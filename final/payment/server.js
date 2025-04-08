const amqp = require("amqplib");

const QUEUE_NAME = "order.created";

async function startPaymentService() {
  const connection = await amqp.connect({
    protocol: "amqp",
    hostname: "rabbitmq",
    port: 5672,
    username: "admin",
    password: "admin",
    vhost: "/",
  });
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME);
  console.log("💳 PaymentService waiting for events...");

  channel.consume(QUEUE_NAME, async (msg) => {
    const event = JSON.parse(msg.content.toString());
    console.log(
      `[${new Date().toISOString()}] 💳 Processing payment for order ${
        event.orderId
      } - $${event.amount}`
    );
    // simulate processing...
    channel.ack(msg);
  });
}

startPaymentService();
