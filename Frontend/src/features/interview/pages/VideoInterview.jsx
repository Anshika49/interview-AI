import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import "../style/videoInterview.scss"
import PermissionModal from '../components/PermissionModal'
import { useVideoInterview } from '../hooks/useVideoInterview'
import { apiBaseUrl } from '../../../config/api'

const TOTAL_QUESTIONS = 5

const DIFFICULTY_LABEL = {
    basic: 'Introduction',
    easy: 'Easy',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    scenario: 'Scenario-Based',
}

const getSpeechRecognitionClass = () => window.SpeechRecognition || window.webkitSpeechRecognition

const VideoInterview = () => {

    const { interviewId } = useParams()
    const navigate = useNavigate()
    const { startInterview, submitAnswer, endInterview } = useVideoInterview()

    // 'permission' -> 'interview' -> 'evaluating' -> 'completed'
    const [ phase, setPhase ] = useState('permission')
    const [ error, setError ] = useState('')

    const [ videoInterviewId, setVideoInterviewId ] = useState(null)
    const [ questionNumber, setQuestionNumber ] = useState(1)
    const [ currentQuestion, setCurrentQuestion ] = useState('')
    const [ currentDifficulty, setCurrentDifficulty ] = useState('basic')

    const [ isListening, setIsListening ] = useState(false)
    const [ finalTranscript, setFinalTranscript ] = useState('')
    const [ interimTranscript, setInterimTranscript ] = useState('')
    const [ manualTranscript, setManualTranscript ] = useState('')
    const [ speechSupported, setSpeechSupported ] = useState(true)
    const [ transitionKey, setTransitionKey ] = useState(0)

    const [ showEndConfirm, setShowEndConfirm ] = useState(false)
    const [ isEnding, setIsEnding ] = useState(false)
    const [ endedEarly, setEndedEarly ] = useState(false)
    const [ answeredCount, setAnsweredCount ] = useState(0)

    const videoRef = useRef(null)
    const cameraStreamRef = useRef(null)
    const recognitionRef = useRef(null)
    const isListeningRef = useRef(false)

    // Mirrors the latest phase/videoInterviewId/questionNumber so unmount and
    // beforeunload handlers (which close over stale state otherwise) can read
    // current values without needing to be re-created on every render.
    const latestRef = useRef({ phase, videoInterviewId, questionNumber })
    useEffect(() => {
        latestRef.current = { phase, videoInterviewId, questionNumber }
    }, [ phase, videoInterviewId, questionNumber ])

    // If the candidate leaves mid-interview (browser back, closing the tab,
    // navigating elsewhere in the app) without explicitly clicking "End
    // Interview", the record would otherwise stay stuck as "in-progress"
    // forever — invisible on the report page and effectively losing whatever
    // they'd already answered. Auto-finalize it as incomplete instead.
    useEffect(() => {
        const finalizeIfAbandoned = () => {
            const { phase: currentPhase, videoInterviewId: currentId, questionNumber: currentQNum } = latestRef.current
            const midInterview = (currentPhase === 'interview' || currentPhase === 'evaluating') && currentId && currentQNum > 1
            if (midInterview) {
                navigator.sendBeacon(`${apiBaseUrl}/api/interview/video/${currentId}/end`)
            }
        }

        window.addEventListener('beforeunload', finalizeIfAbandoned)
        return () => {
            window.removeEventListener('beforeunload', finalizeIfAbandoned)
            finalizeIfAbandoned() // component unmount = in-app navigation away
        }
    }, [])

    useEffect(() => {
        const SpeechRecognitionClass = getSpeechRecognitionClass()
        if (!SpeechRecognitionClass) {
            setSpeechSupported(false)
            return
        }

        const recognition = new SpeechRecognitionClass()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event) => {
            let interim = ''
            let final = ''
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const piece = event.results[ i ][ 0 ].transcript
                if (event.results[ i ].isFinal) {
                    final += piece + ' '
                } else {
                    interim += piece
                }
            }
            if (final) {
                setFinalTranscript(prev => (prev + ' ' + final).trim())
            }
            setInterimTranscript(interim)
        }

        recognition.onerror = () => {
            // swallow transient errors (e.g. brief silence timeouts); onend handles restart
        }

        recognition.onend = () => {
            if (isListeningRef.current) {
                try { recognition.start() } catch { /* already started */ }
            }
        }

        recognitionRef.current = recognition

        return () => {
            isListeningRef.current = false
            try { recognition.stop() } catch { /* noop */ }
        }
    }, [])

    useEffect(() => {
        return () => {
            cameraStreamRef.current?.getTracks().forEach(track => track.stop())
        }
    }, [])

    const handlePermissionGranted = async (stream) => {
        cameraStreamRef.current = stream

        setError('')
        try {
            const response = await startInterview(interviewId)
            setVideoInterviewId(response.videoInterviewId)
            setQuestionNumber(response.questionNumber)
            setCurrentQuestion(response.question)
            setCurrentDifficulty(response.difficulty)
            setPhase('interview')
        } catch (err) {
            if (err?.response?.status === 401) {
                navigate('/login', { state: { redirectTo: `/interview/${interviewId}/video-interview` } })
                return
            }
            setError(err?.response?.data?.message || 'Something went wrong while starting your interview. Please try again.')
            setPhase('permission')
        }
    }

    // The <video> element only exists in the DOM once we're in the 'interview'
    // phase (the permission modal renders in its place before that). Bind the
    // already-granted camera stream to it as soon as it mounts, rather than
    // trying to set srcObject at grant-time when the element doesn't exist yet.
    useEffect(() => {
        if (phase === 'interview' && videoRef.current && cameraStreamRef.current) {
            videoRef.current.srcObject = cameraStreamRef.current
        }
    }, [ phase ])

    const handleCancelPermissions = () => {
        navigate(`/interview/${interviewId}`)
    }

    const startAnswering = () => {
        setFinalTranscript('')
        setInterimTranscript('')
        setManualTranscript('')
        isListeningRef.current = true
        setIsListening(true)
        try { recognitionRef.current?.start() } catch { /* already running */ }
    }

    const stopListening = () => {
        isListeningRef.current = false
        setIsListening(false)
        try { recognitionRef.current?.stop() } catch { /* noop */ }
    }

    const handleSubmitAnswer = async () => {
        stopListening()

        const transcript = speechSupported
            ? (finalTranscript + ' ' + interimTranscript).trim()
            : manualTranscript.trim()

        setPhase('evaluating')

        try {
            const response = await submitAnswer({ videoInterviewId, transcript })

            if (response.completed) {
                setPhase('completed')
                setTimeout(() => {
                    navigate(`/interview/${interviewId}`, { state: { section: 'video-interview' } })
                }, 2200)
                return
            }

            setQuestionNumber(response.questionNumber)
            setCurrentQuestion(response.question)
            setCurrentDifficulty(response.difficulty)
            setFinalTranscript('')
            setInterimTranscript('')
            setManualTranscript('')
            setTransitionKey(prev => prev + 1)
            setPhase('interview')
        } catch (err) {
            if (err?.response?.status === 401) {
                navigate('/login', { state: { redirectTo: `/interview/${interviewId}/video-interview` } })
                return
            }
            setError(err?.response?.data?.message || 'Something went wrong while evaluating your answer. Please try again.')
            setPhase('interview')
        }
    }

    const handleEndInterview = async () => {
        stopListening()
        setShowEndConfirm(false)
        setIsEnding(true)
        setError('')

        try {
            const response = await endInterview(videoInterviewId)
            setAnsweredCount(response.answeredCount ?? (questionNumber - 1))
            setEndedEarly(true)
            setPhase('completed')
            setTimeout(() => {
                navigate(`/interview/${interviewId}`, { state: { section: 'video-interview' } })
            }, 2200)
        } catch (err) {
            if (err?.response?.status === 401) {
                navigate('/login', { state: { redirectTo: `/interview/${interviewId}/video-interview` } })
                return
            }
            setError(err?.response?.data?.message || 'Something went wrong while ending your interview. Please try again.')
            setIsEnding(false)
        }
    }

    if (phase === 'permission') {
        return (
            <div className='video-interview-page video-interview-page--gate'>
                <PermissionModal onGranted={handlePermissionGranted} onCancel={handleCancelPermissions} />
                {error && <p className='video-interview-page__gate-error'>{error}</p>}
            </div>
        )
    }

    if (phase === 'completed') {
        return (
            <div className='video-interview-page video-interview-page--complete'>
                <div className={`completion-card ${endedEarly ? 'completion-card--incomplete' : ''}`}>
                    <span className='completion-card__icon'>
                        {endedEarly ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                        )}
                    </span>
                    <h1>{endedEarly ? 'Interview Ended — Incomplete' : 'Interview Completed Successfully'}</h1>
                    <p>
                        {endedEarly
                            ? `You answered ${answeredCount} of ${TOTAL_QUESTIONS} questions before ending early. Your partial report is being compiled…`
                            : 'Your responses are being compiled into your interview report…'}
                    </p>
                </div>
            </div>
        )
    }

    const progressPercent = ((questionNumber - 1) / TOTAL_QUESTIONS) * 100
    const liveTranscript = speechSupported ? `${finalTranscript} ${interimTranscript}`.trim() : manualTranscript
    const isEvaluating = phase === 'evaluating'

    return (
        <div className='video-interview-page'>
            <div className='video-interview-shell'>

                {/* Header / progress */}
                <div className='vi-header'>
                    <div className='vi-header__title'>
                        <h1>AI Video Interview</h1>
                        <span className='vi-header__difficulty'>{DIFFICULTY_LABEL[ currentDifficulty ] || 'Question'}</span>
                    </div>
                    <div className='vi-header__progress'>
                        <span>Question {questionNumber} of {TOTAL_QUESTIONS}</span>
                        <div className='vi-progress-bar'>
                            <div className='vi-progress-bar__fill' style={{ width: `${progressPercent}%` }} />
                        </div>
                    </div>
                    <button
                        className='button vi-end-btn'
                        disabled={isEnding}
                        onClick={() => setShowEndConfirm(true)}
                    >
                        End Interview
                    </button>
                </div>

                {showEndConfirm && (
                    <div className='permission-modal-overlay'>
                        <div className='permission-modal vi-end-confirm'>
                            <div className='permission-modal__header'>
                                <span className='permission-modal__icon vi-end-confirm__icon'>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                </span>
                                <h2>End Interview Early?</h2>
                                <p>
                                    You've answered {Math.max(questionNumber - 1, 0)} of {TOTAL_QUESTIONS} questions so far.
                                    If you end now, your report will only include the questions you've already answered
                                    and will be marked as an <strong>incomplete interview</strong>. This can't be undone.
                                </p>
                            </div>
                            <div className='permission-modal__actions'>
                                <button className='button ghost-button' onClick={() => setShowEndConfirm(false)}>
                                    Keep Going
                                </button>
                                <button className='button vi-end-confirm__confirm-btn' onClick={handleEndInterview} disabled={isEnding}>
                                    {isEnding ? 'Ending…' : 'End Interview'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {error && <div className='vi-error'>{error}</div>}

                {/* Video stage */}
                <div className='vi-stage'>
                    <div className='vi-stage__panel vi-stage__panel--user'>
                        <video ref={videoRef} autoPlay muted playsInline className='vi-video' />
                        <span className='vi-stage__label'>You</span>
                        {isListening && <span className='vi-recording-dot'>● Listening</span>}
                    </div>

                    <div className='vi-stage__panel vi-stage__panel--ai'>
                        <div className='ai-avatar'>
                            <div className='ai-avatar__glow' />
                            <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="4" y="7" width="16" height="12" rx="3" />
                                <circle cx="9" cy="13" r="1.3" fill="currentColor" stroke="none" />
                                <circle cx="15" cy="13" r="1.3" fill="currentColor" stroke="none" />
                                <path d="M9 16.5c1 .8 5 .8 6 0" />
                                <path d="M12 7V4" />
                                <circle cx="12" cy="2.6" r="1.2" fill="currentColor" stroke="none" />
                            </svg>
                        </div>
                        <span className='vi-stage__label'>AI Interviewer</span>
                    </div>
                </div>

                {/* Question + transcript */}
                <div className='vi-bottom' key={transitionKey}>
                    <div className='vi-question'>
                        <span className='vi-question__tag'>Q{questionNumber}</span>
                        <p>{isEvaluating ? 'Evaluating your answer…' : currentQuestion}</p>
                    </div>

                    <div className='vi-transcript'>
                        <p className='vi-transcript__label'>Live Transcript</p>
                        {speechSupported ? (
                            <div className='vi-transcript__box'>
                                {liveTranscript ? liveTranscript : <span className='vi-transcript__placeholder'>Click "Start Answering" and begin speaking — your words will appear here.</span>}
                            </div>
                        ) : (
                            <div className='vi-transcript__box'>
                                <textarea
                                    className='vi-transcript__fallback-input'
                                    placeholder="Your browser doesn't support speech recognition — type your answer here instead."
                                    value={manualTranscript}
                                    onChange={(e) => setManualTranscript(e.target.value)}
                                    disabled={isEvaluating}
                                />
                            </div>
                        )}
                    </div>

                    <div className='vi-controls'>
                        {speechSupported && !isListening && (
                            <button className='button primary-button' disabled={isEvaluating} onClick={startAnswering}>
                                Start Answering
                            </button>
                        )}
                        {speechSupported && isListening && (
                            <button className='button primary-button vi-controls__submit' disabled={isEvaluating} onClick={handleSubmitAnswer}>
                                {isEvaluating ? 'Submitting…' : "I'm Done — Submit Answer"}
                            </button>
                        )}
                        {!speechSupported && (
                            <button className='button primary-button' disabled={isEvaluating || !manualTranscript.trim()} onClick={handleSubmitAnswer}>
                                {isEvaluating ? 'Submitting…' : 'Submit Answer'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VideoInterview
