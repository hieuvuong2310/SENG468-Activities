const express = require("express");
const app = express();
app.use(express.json());

const PORT = 3002;

app.get("/check", (req, res) => {
  const productId = req.query.productId;
  const available = productId === "1"; // simulate one available product
  console.log(
    `[${new Date().toISOString()}] 🔍 Inventory check for ${productId}: ${available}`
  );
  res.json({ available });
});

app.listen(PORT, () => {
  console.log(`🚀 [ProductService] running on port ${PORT}`);
});
