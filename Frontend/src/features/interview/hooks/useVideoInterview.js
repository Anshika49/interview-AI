import { startVideoInterview, submitVideoInterviewAnswer, endVideoInterview, getVideoInterviewByReportId, getVideoInterviewById } from "../services/videoInterview.api"
import { useContext } from "react"
import { VideoInterviewContext } from "../videoInterview.context"

export const useVideoInterview = () => {

    const context = useContext(VideoInterviewContext)

    if (!context) {
        throw new Error("useVideoInterview must be used within a VideoInterviewProvider")
    }

    const { loading, setLoading, videoInterview, setVideoInterview } = context

    const startInterview = async (interviewReportId) => {
        setLoading(true)
        try {
            const response = await startVideoInterview({ interviewReportId })
            return response
        } finally {
            setLoading(false)
        }
    }

    const submitAnswer = async ({ videoInterviewId, transcript }) => {
        const response = await submitVideoInterviewAnswer({ videoInterviewId, transcript })
        return response
    }

    const endInterview = async (videoInterviewId) => {
        const response = await endVideoInterview(videoInterviewId)
        return response
    }

    const getReportVideoInterview = async (interviewReportId) => {
        setLoading(true)
        try {
            const response = await getVideoInterviewByReportId(interviewReportId)
            setVideoInterview(response.videoInterview)
            return response.videoInterview
        } catch (error) {
            console.log(error)
        } finally {
            setLoading(false)
        }
    }

    const getInterviewById = async (videoInterviewId) => {
        const response = await getVideoInterviewById(videoInterviewId)
        return response.videoInterview
    }

    return { loading, videoInterview, startInterview, submitAnswer, endInterview, getReportVideoInterview, getInterviewById }
}
