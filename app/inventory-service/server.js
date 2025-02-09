const express = require("express");

const app = express();
app.use(express.json());

const PORT = 4000;

const inventory = {
  item1: true,
  item2: false,
};

app.get("/check-availability", (req, res) => {
  const { itemId } = req.query;
  const available = inventory[itemId] || false;
  if (itemId in inventory) {
    return res.status(200).json({ available });
  } else {
    return res.status(400).json({ message: "Item is not in inventory list" });
  }
});

app.listen(PORT, () => {
  console.log(`Inventory Service running on port ${PORT}`);
});
