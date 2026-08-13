import { RouterProvider } from "react-router"
import { router } from "./app.routes.jsx"
import { AuthProvider } from "./features/auth/auth.context.jsx"
import { InterviewProvider } from "./features/interview/interview.context.jsx"
import { VideoInterviewProvider } from "./features/interview/videoInterview.context.jsx"
function App() {


  return (
    
    <AuthProvider>
      <InterviewProvider>
        <VideoInterviewProvider>
      <RouterProvider router={router} />
      </VideoInterviewProvider>
      </InterviewProvider>
      </AuthProvider>
    
  )
}

export default App
