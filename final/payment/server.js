const express = require("express");
const app = express();
app.use(express.json());

const PORT = 3001;

app.post("/pay", (req, res) => {
  const { amount } = req.body;
  console.log(
    `[${new Date().toISOString()}] 💰 Payment request received: $${amount}`
  );
  res.json({ status: "paid" }); // simulate success
});

app.listen(PORT, () => {
  console.log(`🚀 [PaymentService] running on port ${PORT}`);
});
