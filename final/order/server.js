const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const PORT = 3000;

const PRODUCT_SERVICE_URL = "http://api-gateway:8080/api/product";
const PAYMENT_SERVICE_URL = "http://api-gateway:8080/api/payment";

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

app.post("/placeOrder", async (req, res) => {
  const { productId } = req.body;
  log(`📦 [ORDER SERVICE] Received order request for product ${productId}`);

  try {
    // Step 1: Check inventory
    log(`🔍 [ORDER SERVICE] Checking inventory for product ${productId}`);
    const invRes = await axios.get(`${PRODUCT_SERVICE_URL}/check`, {
      params: { productId },
    });

    if (!invRes.data.available) {
      log("❌ [ORDER SERVICE] Product not available");
      return res.status(400).send("Product out of stock.");
    }

    // Step 2: Record order (mock)
    log(
      `📝 [ORDER SERVICE] Product available. Recording order for ${productId}`
    );

    // Step 3: Process payment
    log(`💰 [ORDER SERVICE] Requesting payment for product ${productId}`);
    const paymentRes = await axios.post(`${PAYMENT_SERVICE_URL}/pay`, {
      amount: 25, // example
    });

    if (paymentRes.data.status === "paid") {
      log("✅ [ORDER SERVICE] Order placed and payment successful");
      res.status(200).send("Order completed.");
    } else {
      log("❌ [ORDER SERVICE] Payment failed");
      res.status(500).send("Payment failed.");
    }
  } catch (err) {
    log(`🔴 [ORDER SERVICE] Error occurred: ${err.message}`);
    res.status(500).send("Order failed.");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 [OrderService] running on port ${PORT}`);
});
