const Redis = require("ioredis")

const redisClient = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: 2,
    retryStrategy(times) {
        return Math.min(times * 200, 5000)
    }
})

redisClient.on("connect", () => {
    console.log("redis connected")
})

redisClient.on("error", (err) => {
    console.error("redis error:", err.message)
})

module.exports = redisClient
