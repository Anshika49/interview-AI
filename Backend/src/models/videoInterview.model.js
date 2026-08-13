const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
    score:{
        type:Number,
        min:0,
        max:10,
        required:[true,"score is required"]
    },
 accuracy: {
        type: Number,
        min: 0,
        max: 10,
    },
    communication: {
        type: Number,
        min: 0,
        max: 10,
    },
    technicalKnowledge: {
        type: Number,
        min: 0,
        max: 10,
    },
    confidence: {
        type: Number,
        min: 0,
        max: 10,
    },
    completeness: {
        type: Number,
        min: 0,
        max: 10,
    },
    feedback: {
        type: String,
        required: [ true, "feedback is required" ]
    },
    correctAnswer: {
        type: String,
        required: [ true, "correct answer is required" ]
    },
    improvementSuggestions: [ {
        type: String
    } ]
},{
    _id:false
})

const videoInterviewQuestionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: [ true, "question is required" ]
    },
    difficulty: {
        type: String,
        enum: [ "basic", "easy", "intermediate", "advanced", "scenario" ],
        required: [ true, "difficulty is required" ]
    },
    transcript: {
        type: String,
        default: ""
    },
    evaluation: {
        type: evaluationSchema,
        default: null
    }
}, {
    _id: false
})

const videoInterviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    interviewReport: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InterviewReport",
        required: true
    },
    jobDescription: {
        type: String,
    },
    status: {
        type: String,
        enum: [ "in-progress", "completed","incomplete" ],
        default: "in-progress"
    },
    questions: [ videoInterviewQuestionSchema ],
    overallScore: {
        type: Number,
        min: 0,
        max: 10,
    },
    overallRating: {
        type: String,
    },
    strengths: [ {
        type: String
    } ],
    weaknesses: [ {
        type: String
    } ],
    hiringRecommendation: {
        type: String,
    },
    interviewDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
})

const videoInterviewModel = mongoose.model("VideoInterview", videoInterviewSchema);
module.exports = videoInterviewModel;