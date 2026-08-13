import { createContext, useState } from "react";


export const VideoInterviewContext = createContext()

export const VideoInterviewProvider = ({ children }) => {
    const [ loading, setLoading ] = useState(false)
    const [ videoInterview, setVideoInterview ] = useState(null)

    return (
        <VideoInterviewContext.Provider value={{ loading, setLoading, videoInterview, setVideoInterview }}>
            {children}
        </VideoInterviewContext.Provider>
    )
}
