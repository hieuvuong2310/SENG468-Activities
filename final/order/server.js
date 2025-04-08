const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const PORT = 3000;
const PAYMENT_SERVICE_URL = "http://api-gateway:8080/api/payment";
const ORDER_SERVICE_URL = "http://api-gateway:8080/api/order";

// Simulate local state
let localState = "idle";

// OrderService's own prepare logic
app.post("/prepare", async (req, res) => {
  console.log("🟡 [OrderService] Received prepare");
  localState = "prepared";
  res.json({ status: "ready" });
});

app.post("/commit", async (req, res) => {
  if (localState === "prepared") {
    localState = "committed";
    console.log("✅ [OrderService] Committed");
    res.json({ status: "committed" });
  } else {
    res.status(400).json({ status: "invalid state" });
  }
});

app.post("/abort", async (req, res) => {
  localState = "aborted";
  console.log("❌ [OrderService] Aborted");
  res.json({ status: "aborted" });
});

app.get("/", (req, res) => {
  res.send("Order Service is running!");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP" });
});

// Coordinator endpoint to start the transaction

// Coordinator endpoint to start the transaction
app.post("/", async (req, res) => {
  console.log("🔄 Starting 2PC transaction...");

  try {
    // Phase 1: Prepare
    console.log("🟡 Phase 1: Sending prepare to both services...");

    const results = await Promise.all([
      axios.post(`${ORDER_SERVICE_URL}/prepare`), // OrderService itself
      axios.post(`${PAYMENT_SERVICE_URL}/prepare`),
    ]);

    if (!results.every(r => r.data.status === "ready")) {
      throw new Error("Not all services are ready");
    }

    // Phase 2: Commit
    console.log("🟢 All services ready. Sending commit...");
    await Promise.all([
      axios.post(`${ORDER_SERVICE_URL}/commit`),
      axios.post(`${PAYMENT_SERVICE_URL}/commit`)
    ]);

    console.log("✅ [Order Service] Transaction committed");
    res.status(200).send("Order placed and payment processed.");
  } catch (err) {
    console.error(
      "🔴 [Order Service] Error or abort received. Sending abort..."
    );
    await Promise.allSettled([
      axios.post(`${ORDER_SERVICE_URL}/abort`),
      axios.post(`${PAYMENT_SERVICE_URL}/abort`)
    ]);
    console.log("❌ Transaction aborted");
    res.status(500).send("Transaction failed. Rolled back.");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Order Service running on port ${PORT}`);
});
