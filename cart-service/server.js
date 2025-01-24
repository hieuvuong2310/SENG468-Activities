const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = 3000;
const cart = [];

app.post("/add-to-cart", async (req, res) => {
  const { itemId } = req.body;

  try {
    const response = await axios.get(
      `http://localhost:4000/check-availability?itemdId=${itemId}`
    );
    console.log("response", response.data);
    if (response.data.available) {
      cart.push(itemId);
      return res.status(200).json({ message: "Item added to cart", cart });
    } else {
      return res.status(400).json({ message: "Item is out of stock" });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error communicating with Inventory Service" });
  }
});

app.listen(PORT, () => {
  console.log(`Cart Service running on port ${PORT}`);
});
