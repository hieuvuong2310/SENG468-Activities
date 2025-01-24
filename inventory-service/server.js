const express = require("express");

const app = express();
app.use(express.json());

const PORT = 4000;

const inventory = {
  item1: true,
  item2: false,
};

app.get("/check-availability", (req, res) => {
  const { itemId } = req.body;
  console.log("itemId", itemId);
  const available = inventory[itemId] || false;
  console.log("available", available);
  res.status(200).json({ available });
});

app.listen(PORT, () => {
  console.log(`Inventory Service running on port ${PORT}`);
});
