const express = require("express");
const app = express();
app.use(express.json());

const PORT = 3001;

let state = "idle";

app.get("/", (req, res) => {
  res.send("Payment Service is running!");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP" });
});

app.post("/prepare", async (req, res) => {
  const delay = Math.floor(Math.random() * 3000) + 3000; // 3000–6000ms (3–6s)
  console.log(`🕒 [Payment Service] Simulating delay of ${delay}ms...`);

  await new Promise((resolve) => setTimeout(resolve, delay)); // simulate delay

  console.log("🟡 [Payment Service] Received prepare request");
  state = "prepared";
  res.status(200).json({ status: "ready" });
});

app.post("/commit", (req, res) => {
  if (state === "prepared") {
    state = "committed";
    console.log("✅ [Payment Service] Committed transaction");
    res.json({ status: "committed" });
  } else {
    res.status(400).json({ status: "invalid state" });
  }
});

app.post("/abort", (req, res) => {
  if (state === "prepared") {
    state = "aborted";
    console.log("❌ [Payment Service] Aborted transaction");
  } else {
    console.log(
      "❌ [Payment Service] Abort received but not in prepared state"
    );
  }
  res.json({ status: "aborted" });
});

app.listen(PORT, () => {
  console.log(`🚀 Payment Service running on port ${PORT}`);
});
