import React, { useEffect, useState } from 'react'
import "../style/permissionModal.scss"

const StatusPill = ({ status }) => {
    if (status === 'granted') {
        return <span className='status-pill status-pill--granted'>Granted</span>
    }
    if (status === 'denied') {
        return <span className='status-pill status-pill--denied'>Denied</span>
    }
    if (status === 'checking') {
        return <span className='status-pill status-pill--checking'>Checking…</span>
    }
    return <span className='status-pill status-pill--idle'>Not requested</span>
}

/**
 * @description Modal that requests camera + microphone permission before the AI Video
 * Interview can start. Interview cannot begin until both permissions are granted.
 * @param {Function} onGranted - called with the live camera MediaStream once both permissions are granted
 * @param {Function} onCancel - called when the user backs out of the flow
 */
const PermissionModal = ({ onGranted, onCancel }) => {

    const [ cameraStatus, setCameraStatus ] = useState('idle')
    const [ micStatus, setMicStatus ] = useState('idle')
    const [ cameraStream, setCameraStream ] = useState(null)

    const requestPermissions = async () => {
        setCameraStatus('checking')
        setMicStatus('checking')

        try {
            const liveCameraStream = await navigator.mediaDevices.getUserMedia({ video: true })
            setCameraStatus('granted')
            setCameraStream(liveCameraStream)
        } catch {
            setCameraStatus('denied')
        }

        try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            // We only need the permission grant here — live audio capture for the
            // interview transcript is handled separately by the speech recognition API.
            micStream.getTracks().forEach(track => track.stop())
            setMicStatus('granted')
        } catch {
            setMicStatus('denied')
        }
    }

    useEffect(() => {
        requestPermissions()
        return () => {
            cameraStream?.getTracks().forEach(track => track.stop())
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const bothGranted = cameraStatus === 'granted' && micStatus === 'granted'
    const eitherDenied = cameraStatus === 'denied' || micStatus === 'denied'
    const stillChecking = cameraStatus === 'checking' || micStatus === 'checking'

    const handleRetry = () => {
        requestPermissions()
    }

    const handleContinue = () => {
        if (!bothGranted || !cameraStream) return
        onGranted(cameraStream)
    }

    return (
        <div className='permission-modal-overlay'>
            <div className='permission-modal'>
                <div className='permission-modal__header'>
                    <span className='permission-modal__icon'>
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                    </span>
                    <h2>Camera &amp; Microphone Access</h2>
                    <p>Your AI Video Interview requires access to your camera and microphone so the interviewer can see and hear your responses. Nothing is recorded — only a live transcript of your answers is used for evaluation.</p>
                </div>

                <div className='permission-modal__list'>
                    <div className='permission-row'>
                        <div className='permission-row__label'>
                            <span className='permission-row__icon'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                            </span>
                            <div>
                                <p className='permission-row__title'>Camera</p>
                                <p className='permission-row__subtitle'>Needed so the interview screen can show your live video</p>
                            </div>
                        </div>
                        <StatusPill status={cameraStatus} />
                    </div>

                    <div className='permission-row'>
                        <div className='permission-row__label'>
                            <span className='permission-row__icon'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                            </span>
                            <div>
                                <p className='permission-row__title'>Microphone</p>
                                <p className='permission-row__subtitle'>Needed to convert your spoken answers into text</p>
                            </div>
                        </div>
                        <StatusPill status={micStatus} />
                    </div>
                </div>

                {eitherDenied && (
                    <div className='permission-modal__error'>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        <p>
                            {cameraStatus === 'denied' && micStatus === 'denied' ? 'Camera and microphone access were denied.' :
                                cameraStatus === 'denied' ? 'Camera access was denied.' : 'Microphone access was denied.'}
                            {' '}Please allow access in your browser's permission settings, then retry.
                        </p>
                    </div>
                )}

                <div className='permission-modal__actions'>
                    <button className='button ghost-button' onClick={onCancel}>Cancel</button>
                    {eitherDenied ? (
                        <button className='button primary-button' onClick={handleRetry}>Retry</button>
                    ) : (
                        <button
                            className='button primary-button'
                            disabled={!bothGranted || stillChecking}
                            onClick={handleContinue}
                        >
                            {stillChecking ? 'Requesting Access…' : 'Continue'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default PermissionModal
