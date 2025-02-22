const amqp = require("amqplib");

async function deleteQueue() {
  try {
    // Connect to RabbitMQ
    const connection = await amqp.connect("amqp://rabbitmq"); // Change if needed
    const channel = await connection.createChannel();

    const queueName = "inventory_queue"; // Change this to the queue you want to delete

    await channel.deleteQueue(queueName);
    console.log(`✅ Queue "${queueName}" deleted successfully!`);

    await channel.close();
    await connection.close();
  } catch (error) {
    console.error("❌ Error deleting queue:", error);
  }
}

// Run the function
deleteQueue();
