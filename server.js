const express = require("express");
const Redis = require("redis");
const fs = require("fs");
const { promisify } = require("util");

// Set up Redis client
const redisClient = Redis.createClient();
const lpushAsync = promisify(redisClient.lpush).bind(redisClient);
const rpopAsync = promisify(redisClient.rpop).bind(redisClient);
const ttlAsync = promisify(redisClient.ttl).bind(redisClient);
const incrAsync = promisify(redisClient.incr).bind(redisClient);

// Connect Redis
redisClient.on("connect", () => console.log("Connected to Redis"));
redisClient.on("error", (err) => console.error("Redis error:", err));

// Initialize Express app
const app = express();
app.use(express.json());

// Rate limits
const MAX_TASKS_PER_SECOND = 1;
const MAX_TASKS_PER_MINUTE = 20;

// Task processing
async function processTask(user_id) {
  const logEntry = `${user_id}-task completed at-${Date.now()}\n`;
  fs.appendFileSync("task.log", logEntry);
  console.log(logEntry.trim());
}

// Queue handler
async function handleQueue(user_id) {
  const queueKey = `queue:${user_id}`;
  const rateKey = `rate:${user_id}`;

  while (true) {
    const task = await rpopAsync(queueKey);
    if (!task) break;

    // Process task
    await processTask(user_id);

    // Respect 1 task/second rate limit
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update rolling counter for tasks per minute
    const count = await incrAsync(rateKey);
    if (count === 1) {
      redisClient.expire(rateKey, 60); // Set TTL for the counter
    }
  }
}

// API route
app.post("/task", async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).send({ error: "Missing user_id" });

  const queueKey = `queue:${user_id}`;
  const rateKey = `rate:${user_id}`;

  try {
    // Check rate limits
    const currentCount = parseInt(await incrAsync(rateKey)) || 0;
    if (currentCount === 1) {
      redisClient.expire(rateKey, 60); // Set TTL for the counter
    }

    if (currentCount > MAX_TASKS_PER_MINUTE) {
      return res.status(429).send({ error: "Rate limit exceeded" });
    }

    // Add task to user's queue
    await lpushAsync(queueKey, JSON.stringify(req.body));

    // Process tasks if not already running
    handleQueue(user_id);

    res.status(202).send({ message: "Task queued" });
  } catch (err) {
    console.error("Error processing task:", err);
    res.status(500).send({ error: "Internal server error" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
