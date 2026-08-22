const express = require("express")
const redisClient = require("../config/redis")

const healthRouter = express.Router()

healthRouter.get("/redis", async (req, res) => {

    const startedAt = Date.now()

    try {
        const pong = await redisClient.ping()
        const latencyMs = Date.now() - startedAt

        const [ rateLimitCount, rateLimitTtl ] = await Promise.all([
            redisClient.get("ratelimit:gemini"),
            redisClient.ttl("ratelimit:gemini")
        ])

        return res.status(200).json({
            status: "connected",
            ping: pong,
            latencyMs,
            geminiRateLimit: {
                currentCount: rateLimitCount ? Number(rateLimitCount) : 0,
                max: parseInt(process.env.GEMINI_RATE_LIMIT_MAX || "10", 10),
                windowSeconds: parseInt(process.env.GEMINI_RATE_LIMIT_WINDOW_SECONDS || "60", 10),
                resetsInSeconds: rateLimitTtl > 0 ? rateLimitTtl : null
            }
        })
    } catch (err) {
        return res.status(503).json({
            status: "unreachable",
            message: err.message
        })
    }
})

module.exports = healthRouter
