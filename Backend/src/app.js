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

app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

module.exports = app