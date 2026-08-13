const express = require("express")
const authMiddleware = require("../middlewares/auth.middleware")
const videoInterviewController = require("../controllers/videoInterview.controller")

const videoInterviewRouter = express.Router()

videoInterviewRouter.post("/:interviewReportId/start", authMiddleware.authUser, videoInterviewController.startVideoInterviewController)

videoInterviewRouter.post("/:videoInterviewId/answer", authMiddleware.authUser, videoInterviewController.submitAnswerController)

videoInterviewRouter.post("/:videoInterviewId/end", authMiddleware.authUser, videoInterviewController.endInterviewController)

videoInterviewRouter.get("/report/:interviewReportId", authMiddleware.authUser, videoInterviewController.getVideoInterviewByReportController)

videoInterviewRouter.get("/:videoInterviewId", authMiddleware.authUser, videoInterviewController.getVideoInterviewByIdController)

module.exports = videoInterviewRouter