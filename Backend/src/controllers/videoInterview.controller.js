const videoInterviewModel = require("../models/videoInterview.model")
const interviewReportModel = require("../models/interviewReport.model")
const { generateVideoInterviewQuestion, evaluateVideoInterviewAnswer, generateVideoInterviewSummary } = require("../services/ai.service")

const TOTAL_QUESTIONS = 5

async function startVideoInterviewController(req, res) {

    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const firstQuestion = await generateVideoInterviewQuestion({
        jobDescription: interviewReport.jobDescription,
        resume: interviewReport.resume || interviewReport.selfDescription,
        questionNumber: 1,
        previousQuestions: []
    })

    const videoInterview = await videoInterviewModel.create({
        user: req.user.id,
        interviewReport: interviewReport._id,
        jobDescription: interviewReport.jobDescription,
        status: "in-progress",
        questions: [ {
            question: firstQuestion.question,
            difficulty: firstQuestion.difficulty,
            transcript: "",
            evaluation: null
        } ]
    })

    res.status(201).json({
        message: "Video interview started successfully.",
        videoInterviewId: videoInterview._id,
        questionNumber: 1,
        totalQuestions: TOTAL_QUESTIONS,
        question: firstQuestion.question,
        difficulty: firstQuestion.difficulty
    })
}

async function submitAnswerController(req, res) {

    const { videoInterviewId } = req.params
    const { transcript } = req.body

    const videoInterview = await videoInterviewModel.findOne({ _id: videoInterviewId, user: req.user.id })

    if (!videoInterview) {
        return res.status(404).json({
            message: "Video interview not found."
        })
    }

    if (videoInterview.status !== "in-progress") {
        return res.status(400).json({
            message: "This video interview is no longer in progress."
        })
    }

    const currentIndex = videoInterview.questions.length - 1
    const currentQuestion = videoInterview.questions[ currentIndex ]

    const evaluation = await evaluateVideoInterviewAnswer({
        question: currentQuestion.question,
        transcript,
        jobDescription: videoInterview.jobDescription,
        difficulty: currentQuestion.difficulty
    })

    currentQuestion.transcript = transcript || ""
    currentQuestion.evaluation = evaluation

    // Persist this answer immediately, independent of whatever happens next
    // (generating the next question, or the final summary). An answer the
    // candidate already gave should never be lost to a transient AI failure.
    await videoInterview.save()

    const isLastQuestion = videoInterview.questions.length >= TOTAL_QUESTIONS

    if (isLastQuestion) {

        // Mark the interview completed — this must not depend on the summary
        // call below succeeding.
        videoInterview.status = "completed"
        await videoInterview.save()

        try {
            const summary = await generateVideoInterviewSummary({
                jobDescription: videoInterview.jobDescription,
                questions: videoInterview.questions
            })

            videoInterview.overallScore = summary.overallScore
            videoInterview.overallRating = summary.overallRating
            videoInterview.strengths = summary.strengths
            videoInterview.weaknesses = summary.weaknesses
            videoInterview.hiringRecommendation = summary.hiringRecommendation

            await videoInterview.save()
        } catch (err) {
            // The interview is already saved as "completed" with all 5
            // answered questions above — a failed summary just means
            // overallScore/rating/etc stay unset. The frontend handles that.
            console.error("Failed to generate summary for a completed video interview:", err)
        }

        return res.status(200).json({
            message: "Interview completed successfully.",
            completed: true,
            evaluation,
            videoInterview
        })
    }

    const nextQuestion = await generateVideoInterviewQuestion({
        jobDescription: videoInterview.jobDescription,
        resume: null,
        questionNumber: videoInterview.questions.length + 1,
        previousQuestions: videoInterview.questions
    })

    videoInterview.questions.push({
        question: nextQuestion.question,
        difficulty: nextQuestion.difficulty,
        transcript: "",
        evaluation: null
    })

    await videoInterview.save()

    res.status(200).json({
        message: "Answer evaluated successfully.",
        completed: false,
        evaluation,
        questionNumber: videoInterview.questions.length,
        totalQuestions: TOTAL_QUESTIONS,
        question: nextQuestion.question,
        difficulty: nextQuestion.difficulty
    })
}

async function endInterviewController(req, res) {

    const { videoInterviewId } = req.params

    const videoInterview = await videoInterviewModel.findOne({ _id: videoInterviewId, user: req.user.id })

    if (!videoInterview) {
        return res.status(404).json({
            message: "Video interview not found."
        })
    }

    if (videoInterview.status !== "in-progress") {
        return res.status(200).json({
            message: "This video interview has already ended.",
            videoInterview
        })
    }

    // Only questions that were actually answered and evaluated should be part
    // of the final record — drop any trailing question the candidate never
    // got to answer before ending early.
    const answeredQuestions = videoInterview.questions.filter(q => q.evaluation)

    videoInterview.questions = answeredQuestions
    videoInterview.status = "incomplete"

    // Persist the "ended" state first, independent of the summary call below.
    // Ending the interview must never be blocked or lost because of a
    // transient AI provider failure — the candidate's answered questions are
    // saved regardless of whether we manage to generate an overall summary.
    await videoInterview.save()

    if (answeredQuestions.length > 0) {
        try {
            const summary = await generateVideoInterviewSummary({
                jobDescription: videoInterview.jobDescription,
                questions: answeredQuestions
            })

            videoInterview.overallScore = summary.overallScore
            videoInterview.overallRating = summary.overallRating
            videoInterview.strengths = summary.strengths
            videoInterview.weaknesses = summary.weaknesses
            videoInterview.hiringRecommendation = summary.hiringRecommendation

            await videoInterview.save()
        } catch (err) {
            // The interview is already saved as "incomplete" with its answered
            // questions above — a failed summary just means overallScore/
            // rating/etc stay unset. The frontend handles that gracefully.
            console.error("Failed to generate summary for an early-ended video interview:", err)
        }
    }

    res.status(200).json({
        message: "Interview ended early.",
        completed: true,
        incomplete: true,
        answeredCount: answeredQuestions.length,
        totalQuestions: TOTAL_QUESTIONS,
        videoInterview
    })
}

async function getVideoInterviewByIdController(req, res) {

    const { videoInterviewId } = req.params

    const videoInterview = await videoInterviewModel.findOne({ _id: videoInterviewId, user: req.user.id })

    if (!videoInterview) {
        return res.status(404).json({
            message: "Video interview not found."
        })
    }

    res.status(200).json({
        message: "Video interview fetched successfully.",
        videoInterview
    })
}

async function getVideoInterviewByReportController(req, res) {

    const { interviewReportId } = req.params

    const videoInterview = await videoInterviewModel.findOne({
        interviewReport: interviewReportId,
        user: req.user.id,
        status: { $in: [ "completed", "incomplete" ] }
    }).sort({ createdAt: -1 })

    res.status(200).json({
        message: "Video interview fetched successfully.",
        videoInterview: videoInterview || null
    })
}

module.exports = {
    startVideoInterviewController,
    submitAnswerController,
    endInterviewController,
    getVideoInterviewByIdController,
    getVideoInterviewByReportController
}
