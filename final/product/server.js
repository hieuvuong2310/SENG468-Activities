const express = require("express");
const Redis = require("ioredis");
const app = express();
const redis = new Redis({ host: "redis", port: 6379 });
const PORT = 3002;

const products = {
  1: { name: "Keyboard", category: "electronics" },
  2: { name: "Shampoo", category: "personal_care" },
};

app.get("/:id", async (req, res) => {
  const { id } = req.params;

  const cacheKey = `product:${id}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    console.log(`CACHE HIT for ${cacheKey}`);
    return res.json(JSON.parse(cached));
  }

  const product = products[id];
  if (!product) return res.status(404).send("Not found");

  console.log(`CACHE MISS for ${cacheKey}`);
  await redis.set(cacheKey, JSON.stringify(product), "EX", 3600); // TTL = 60s

  res.json(product);
});

app.listen(PORT, () => console.log("Product service on port 3002"));
