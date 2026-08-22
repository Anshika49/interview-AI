const {GoogleGenAI} = require("@google/genai")
const {z} = require("zod")
const {zodToJsonSchema} = require("zod-to-json-schema")
const puppeteer = require("puppeteer")
const redisClient = require("../config/redis")


const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

// ── Gemini rate limiting ─────────────────────────────────────────────────────
// Fixed-window limiter shared across every Gemini call in this file, backed by
// Redis so it holds across multiple server instances/restarts. Configurable via
// env vars so it can be tuned to whatever quota the API key actually has.
const GEMINI_RATE_LIMIT_MAX = parseInt(process.env.GEMINI_RATE_LIMIT_MAX || "10", 10)
const GEMINI_RATE_LIMIT_WINDOW_SECONDS = parseInt(process.env.GEMINI_RATE_LIMIT_WINDOW_SECONDS || "60", 10)
const GEMINI_RATE_LIMIT_KEY = "ratelimit:gemini"

async function assertGeminiRateLimit() {
    let count
    try {
        count = await redisClient.incr(GEMINI_RATE_LIMIT_KEY)
        if (count === 1) {
            await redisClient.expire(GEMINI_RATE_LIMIT_KEY, GEMINI_RATE_LIMIT_WINDOW_SECONDS)
        }
    } catch (err) {
        // Redis being unreachable shouldn't block every AI feature in the
        // app — fail open on rate limiting specifically and just log it.
        console.error("redis rate limit check failed, failing open:", err.message)
        return
    }

    if (count > GEMINI_RATE_LIMIT_MAX) {
        const rateLimitError = new Error(
            `Too many AI requests right now. Please wait a moment and try again (limit: ${GEMINI_RATE_LIMIT_MAX} requests per ${GEMINI_RATE_LIMIT_WINDOW_SECONDS}s).`
        )
        rateLimitError.status = 429
        rateLimitError.isOperational = true
        throw rateLimitError
    }
}

// Every Gemini call in this file should go through this wrapper instead of
// calling ai.models.generateContent directly, so the rate limit above is
// always enforced consistently.
async function generateContentRateLimited(params) {
    await assertGeminiRateLimit()
    return ai.models.generateContent(params)
}

const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job description"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("the technical question can be asked in the interview"),
        intention:z.string().describe("the intention of interviewer behind asking this question"),
        answer: z.string().describe("how to answer this question, what points to cover, what approach to take etc.")
    })).describe("technical question that can be asked in the interview along with their intention and how to answer them"),
    behaviouralQuestions: z.array(z.object({
        question: z.string().describe("the technical question can be asked in the interview"),
        intention:z.string().describe("the intention of interviewer behind asking this question"),
        answer: z.string().describe("how to answer this question, what points to cover, what approach to take etc.")
    })).describe("behavioural question that can be asked in the interview along with their intention and how to answer them"),
    skillGaps:z.array(z.object({
        skill:z.string().describe("the skill which the candidate is lacking"),
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
   title:z.string().describe("the title of the job for which the interview report is generated"),
})


async function generateInterViewReport({resume,selfDescription,jobDescription}){
   
   

    const prompt = `Generate an interview report for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}`

    const response = await generateContentRateLimited({
    model:"gemini-2.5-flash",
    contents: prompt,
    config:{
        responseMimeType:"application/json",
        responseSchema:zodToJsonSchema(interviewReportSchema)
    }
   })
    return JSON.parse(response.text)

}

async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch()
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
        format: "A4", margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    })

    await browser.close()

    return pdfBuffer
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
                    `

    const response = await generateContentRateLimited({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchema),
        }
    })


    const jsonContent = JSON.parse(response.text)

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html)

    return pdfBuffer

}
// ── AI Video Interview ─────────────────────────────────────────────────────

const DIFFICULTY_STAGE_MAP = {
    1: { difficulty: "basic", focus: "a basic self introduction question, asking the candidate to introduce themselves and their background" },
    2: { difficulty: "easy", focus: "an easy technical concept question relevant to the job description" },
    3: { difficulty: "intermediate", focus: "an intermediate level technical question relevant to the job description" },
    4: { difficulty: "advanced", focus: "an advanced, in-depth technical question relevant to the job description" },
    5: { difficulty: "scenario", focus: "a scenario-based or problem-solving question relevant to the job description" },
}

const videoInterviewQuestionSchema = z.object({
    question: z.string().describe("the next interview question to ask the candidate, one question only"),
})

async function generateVideoInterviewQuestion({ jobDescription, resume, questionNumber, previousQuestions = [] }) {

    const stage = DIFFICULTY_STAGE_MAP[ questionNumber ] || DIFFICULTY_STAGE_MAP[ 5 ]

    const conversationSoFar = previousQuestions.map((q, i) =>
        `Q${i + 1} (${q.difficulty}): ${q.question}\nCandidate's Answer: ${q.transcript}`
    ).join("\n\n")

    const prompt = `You are an experienced technical interviewer. You are conducting a five-question live video interview with a candidate.
                        Ask only one question at a time. Increase the difficulty gradually across the five questions. Ask follow-up questions when appropriate based on the candidate's previous answers.

                        Job Description: ${jobDescription}
                        Candidate Resume / Profile: ${resume || "Not provided"}

                        This is question ${questionNumber} of 5. It should be ${stage.focus}.

                        ${conversationSoFar ? `Conversation so far:\n${conversationSoFar}` : "This is the first question of the interview."}

                        Generate only the next single interview question. Do not ask more than one question. If relevant, the question can build on the candidate's previous answer, otherwise ask a fresh question matching the required difficulty.`

    const response = await generateContentRateLimited({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(videoInterviewQuestionSchema)
        }
    })

    const parsed = JSON.parse(response.text)

    return { question: parsed.question, difficulty: stage.difficulty }
}

const videoInterviewEvaluationSchema = z.object({
    score: z.number().describe("Overall score out of 10 for this answer"),
    accuracy: z.number().describe("Score out of 10 for how accurate/correct the answer was"),
    communication: z.number().describe("Score out of 10 for how clearly and effectively the candidate communicated"),
    technicalKnowledge: z.number().describe("Score out of 10 for the depth of technical knowledge demonstrated"),
    confidence: z.number().describe("Score out of 10 for confidence, judged only from linguistic cues in the transcript such as clarity, hedging language, and filler words, not from appearance"),
    completeness: z.number().describe("Score out of 10 for how complete and thorough the answer was"),
    feedback: z.string().describe("Constructive feedback about the candidate's answer"),
    correctAnswer: z.string().describe("A model / correct answer to this question"),
    improvementSuggestions: z.array(z.string()).describe("Specific, actionable suggestions for the candidate to improve this answer"),
})

async function evaluateVideoInterviewAnswer({ question, transcript, jobDescription, difficulty }) {

    const prompt = `You are evaluating a candidate's interview answer. Return structured JSON containing score, feedback, strengths, weaknesses, improvement suggestions, and a model answer.

                        Job Description: ${jobDescription}
                        Interview Question (difficulty: ${difficulty}): ${question}
                        Candidate's Spoken Answer (transcribed from speech): ${transcript || "The candidate did not provide an answer."}

                        Evaluate the answer on: accuracy, communication, technical knowledge, confidence (based only on linguistic cues present in the transcript, such as hedging, filler words, and clarity - never infer confidence from appearance or tone of voice you cannot observe), and completeness.
                        Provide an overall score out of 10, constructive feedback, the correct/model answer, and specific improvement suggestions.`

    const response = await generateContentRateLimited({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(videoInterviewEvaluationSchema)
        }
    })

    return JSON.parse(response.text)
}

const videoInterviewSummarySchema = z.object({
    overallScore: z.number().describe("The overall interview score out of 10, based on the average performance across all questions"),
    overallRating: z.string().describe("A short overall rating label, e.g. Excellent, Good, Average, Below Average, Poor"),
    strengths: z.array(z.string()).describe("Key strengths the candidate demonstrated across the interview"),
    weaknesses: z.array(z.string()).describe("Key weaknesses or gaps the candidate demonstrated across the interview"),
    hiringRecommendation: z.string().describe("A short hiring recommendation summary, e.g. Strong Hire, Hire, Leaning Hire, No Hire, along with a brief justification"),
})

async function generateVideoInterviewSummary({ jobDescription, questions }) {

    const transcriptSummary = questions.map((q, i) =>
        `Q${i + 1} (${q.difficulty}): ${q.question}\nAnswer: ${q.transcript}\nScore: ${q.evaluation?.score}/10`
    ).join("\n\n")

    const prompt = `You are an experienced technical interviewer wrapping up a five-question live video interview. Based on the full interview transcript below, generate an overall evaluation of the candidate.

                        Job Description: ${jobDescription}

                        Interview Transcript:
                        ${transcriptSummary}

                        Return a structured overall score out of 10, an overall rating label, a list of strengths, a list of weaknesses, and a hiring recommendation.`

    const response = await generateContentRateLimited({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(videoInterviewSummarySchema)
        }
    })

    return JSON.parse(response.text)
}

module.exports = {
    generateInterViewReport,
    generateResumePdf,
    generateVideoInterviewQuestion,
    evaluateVideoInterviewAnswer,
    generateVideoInterviewSummary
}