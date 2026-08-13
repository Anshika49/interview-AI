const express= require("express");
const cookieParser = require("cookie-parser")
const app = express()
const cors = require("cors")

app.use(cors({
    origin: [
      "http://localhost:5173",
      "https://interview-ai-roan-iota.vercel.app",
      "https://interview-r97bojnti-anshikas-projects-cfb4b1b1.vercel.app",
      "https://interview-qrt26xj25-anshikas-projects-cfb4b1b1.vercel.app",
    ],
    credentials:true
}))
app.use(express.json())
app.use(cookieParser())
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")
const videoInterviewRouter = require("./routes/videoInterview.routes")

app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)
app.use("/api/interview/video", videoInterviewRouter)
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err)
    }
    console.error(err)
    res.status(500).json({
        message: "Something went wrong on our end. Please try again."
    })
})

module.exports = app