import axios from "axios";
import { apiBaseUrl } from "../../../config/api";

const api = axios.create({
    baseURL: apiBaseUrl,
    withCredentials: true,
})


/**
 * @description Service to start a new AI video interview for a given interview report.
 */
export const startVideoInterview = async ({ interviewReportId }) => {
    const response = await api.post(`/api/interview/video/${interviewReportId}/start`)

    return response.data
}


/**
 * @description Service to submit a candidate's transcribed answer for evaluation and get the next question.
 */
export const submitVideoInterviewAnswer = async ({ videoInterviewId, transcript }) => {
    const response = await api.post(`/api/interview/video/${videoInterviewId}/answer`, { transcript })

    return response.data
}


/**
 * @description Service to end an in-progress video interview early. Only the questions
 * that were actually answered are kept and summarized; the interview is marked incomplete.
 */
export const endVideoInterview = async (videoInterviewId) => {
    const response = await api.post(`/api/interview/video/${videoInterviewId}/end`)

    return response.data
}


/**
 * @description Service to fetch a video interview by its id.
 */
export const getVideoInterviewById = async (videoInterviewId) => {
    const response = await api.get(`/api/interview/video/${videoInterviewId}`)

    return response.data
}


/**
 * @description Service to fetch the completed video interview linked to an interview report, if any.
 */
export const getVideoInterviewByReportId = async (interviewReportId) => {
    const response = await api.get(`/api/interview/video/report/${interviewReportId}`)

    return response.data
}
