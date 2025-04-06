const express = require("express");
const app = express();
app.use(express.json());

const PORT = 3000;

app.get("/", (req, res) => {
    res.send("Order Service is running!");
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "UP" });
});

app.listen(PORT, async () => {
  console.log(`🚀 Order Service running on port ${PORT}`);
});
