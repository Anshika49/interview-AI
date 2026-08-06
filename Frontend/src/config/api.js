const DEFAULT_LOCAL_API_URL = "http://localhost:3000"
const DEFAULT_PRODUCTION_API_URL = "https://interview-ai-qyav.onrender.com"

export const getApiBaseUrl = () => {
    const configuredUrl = import.meta.env.VITE_API_URL?.trim()

    if (configuredUrl) {
        return configuredUrl.replace(/\/$/, "")
    }

    if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        return DEFAULT_LOCAL_API_URL
    }

    return DEFAULT_PRODUCTION_API_URL
}

export const apiBaseUrl = getApiBaseUrl()
