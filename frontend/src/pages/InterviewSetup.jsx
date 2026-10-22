import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Info, Mic, Camera, XCircle, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, AlertCircle, Keyboard } from 'lucide-react';

// ---------------------------------------------------------------------------
// Start Interview = automatic Camera & Microphone check.
//
// Opened from "Start Interview" (Dashboard / Sidebar). Every session is a
// General Interview (general questions only) in Voice + Camera mode.
//
// The student cannot just click "Looks good" any more. The page CHECKS:
//   * Camera: the interview's own face detector (MediaPipe, via
//     /api/check-face) must find the face clearly and the student must be
//     roughly facing the camera, for several frames in a row. Problems are
//     explained (too dark, face not found, face unclear, not facing camera).
//     Once passed, it stays passed (checking stops), like the mic check.
//     While passing, the student is looking at the camera, so the measured
//     gaze angles are saved as their personal "looking at the camera"
//     calibration (gazeBaseline) and used by Eye Contact in the interview.
//   * Microphone: the student is asked to say something; speech must be
//     heard above a loudness level for long enough.
// Only when both pass does the "Start interview" button become active.
// "Skip check" is still available (no personal gaze calibration then).
// ---------------------------------------------------------------------------

const API = "http://localhost:8000";

// Must match GENERAL_INTERVIEW_ROLE in backend question_bank.py
const GENERAL_INTERVIEW_ROLE = "General Interview";
// Must match CUSTOM_PRACTICE_ROLE in backend custom_practice.py
const CUSTOM_PRACTICE_ROLE = "Custom Practice";

// --- ASSUMPTION - not literature-derived --- device-check thresholds.
const FACE_FRAMES_NEEDED = 3;          // "ready" face frames in a row (~2-3 s)
const FACE_CHECK_GAP_MS = 600;         // gap between face-check requests
const VOICE_RMS_THRESHOLD = 0.02;      // loudness (RMS, 0-1) that counts as speech
const VOICE_SECONDS_NEEDED = 1.5;      // total speech time needed
const VOICE_HINT_AFTER_SECONDS = 8;    // "we can't hear you" hint after this long

const FACE_MESSAGES = {
    CHECKING: "Look straight at the camera while we check...",
    TOO_DARK: "It's too dark. Turn on a light or face a window.",
    NO_FACE: "Face not detected. Sit in front of the camera, a little closer, with light on your face.",
    FACE_UNCLEAR: "Your face is hard to see. Add more light in front of you (not behind you).",
    NOT_FACING_CAMERA: "Please look straight at the camera.",
    OK: "Your face is clearly visible.",
    ERROR: "Camera check is not responding. Check that the backend is running.",
};

const StatusIcon = ({ state }) => {
    if (state === 'ok') return <CheckCircle2 size={20} className="text-green-600 shrink-0" />;
    if (state === 'problem') return <AlertTriangle size={20} className="text-amber-500 shrink-0" />;
    return <Loader2 size={20} className="animate-spin text-slate-400 shrink-0" />;
};

// Card for one automatic check (camera / microphone)
const CheckCard = ({ state, icon, title, children }) => {
    const Icon = icon;
    const tone = state === 'ok'
        ? 'border-green-200 bg-green-50/60'
        : state === 'problem'
            ? 'border-amber-200 bg-amber-50/60'
            : 'border-slate-200 bg-white';
    return (
        <div className={`rounded-xl border p-4 ${tone}`}>
            <div className="flex items-start gap-3">
                <StatusIcon state={state} />
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <Icon size={15} className="text-slate-500" /> {title}
                    </p>
                    {children}
                </div>
            </div>
        </div>
    );
};

const InterviewSetup = () => {
    const navigate = useNavigate();
    const location = useLocation();
    // Custom Practice (supporting feature): the student's own questions,
    // sent here from the Custom Practice page. Absent = standard interview.
    const customQuestions = location.state?.customQuestions || null;
    const isCustom = Array.isArray(customQuestions) && customQuestions.length > 0;
    const sessionRole = isCustom ? CUSTOM_PRACTICE_ROLE : GENERAL_INTERVIEW_ROLE;

    const [deviceCheck, setDeviceCheck] = useState({ status: 'idle', message: '' }); // idle | checking | success | error
    const [audioLevel, setAudioLevel] = useState(0);
    const [isLaunching, setIsLaunching] = useState(false);
    const [startError, setStartError] = useState(''); // shown on the page (no alert popup)

    // Automatic checks
    const [faceReason, setFaceReason] = useState('CHECKING');
    const [faceOk, setFaceOk] = useState(false);
    const [voiceProgress, setVoiceProgress] = useState(0); // 0..1
    const [voiceOk, setVoiceOk] = useState(false);
    const [voiceHint, setVoiceHint] = useState(false);

    const testVideoRef = useRef(null);
    const canvasRef = useRef(null);
    const testStreamRef = useRef(null);
    const audioCtxRef = useRef(null);
    const rafRef = useRef(null);
    const faceTimerRef = useRef(null);
    const faceLoopActiveRef = useRef(false);
    const faceStreakRef = useRef(0);
    const voiceSecondsRef = useRef(0);
    const voiceOkRef = useRef(false);
    const faceOkRef = useRef(false);
    const gazeSamplesRef = useRef([]);   // gaze angles from the passing frames
    const gazeBaselineRef = useRef(null);

    // Every start/stop gets a new number. A camera request that finishes
    // after the check was stopped (page closed, "Try Again", or React
    // StrictMode mounting the page twice in development) sees that its number
    // is old and switches its camera off at once - otherwise that stream was
    // never stopped and the camera light stayed on after leaving the page.
    const startIdRef = useRef(0);

    const stopTest = () => {
        startIdRef.current += 1;   // cancels any camera request still opening
        faceLoopActiveRef.current = false;
        if (faceTimerRef.current) clearTimeout(faceTimerRef.current);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        if (audioCtxRef.current) audioCtxRef.current.close().catch(() => { });
        audioCtxRef.current = null;
        if (testStreamRef.current) testStreamRef.current.getTracks().forEach(track => track.stop());
        testStreamRef.current = null;
        if (testVideoRef.current) testVideoRef.current.srcObject = null;
        setAudioLevel(0);
    };

    // --- Camera: send frames to the interview's face detector -----------------
    const checkFaceOnce = async () => {
        const video = testVideoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !video.videoWidth) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
            const res = await axios.post(`${API}/api/check-face`, {
                image_base64: canvas.toDataURL('image/jpeg', 0.6),
            });
            const reason = res.data.reason || (res.data.ready ? 'OK' : 'NO_FACE');
            if (res.data.ready) {
                faceStreakRef.current += 1;
                if (res.data.gaze_yaw !== null && res.data.gaze_yaw !== undefined) {
                    gazeSamplesRef.current.push({ yaw: res.data.gaze_yaw, pitch: res.data.gaze_pitch });
                }
            } else {
                faceStreakRef.current = 0;
                gazeSamplesRef.current = [];
            }
            if (faceStreakRef.current >= FACE_FRAMES_NEEDED) {
                // Personal calibration = median gaze of the passing frames.
                const samples = gazeSamplesRef.current;
                if (samples.length > 0) {
                    const median = (arr) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
                    gazeBaselineRef.current = {
                        yaw: median(samples.map(g => g.yaw)),
                        pitch: median(samples.map(g => g.pitch)),
                    };
                }
                // Passed once = passed (like the mic check). Stop checking.
                faceOkRef.current = true;
                faceLoopActiveRef.current = false;
                setFaceOk(true);
                setFaceReason('OK');
                return;
            }
            setFaceReason(reason === 'OK' ? 'CHECKING' : reason);
        } catch (err) {
            console.error("Face check failed:", err);
            faceStreakRef.current = 0;
            setFaceReason('ERROR');
        }
    };

    const startFaceLoop = () => {
        faceLoopActiveRef.current = true;
        const loop = async () => {
            if (!faceLoopActiveRef.current || faceOkRef.current) return;
            await checkFaceOnce();
            if (faceLoopActiveRef.current) faceTimerRef.current = setTimeout(loop, FACE_CHECK_GAP_MS);
        };
        faceTimerRef.current = setTimeout(loop, 500);
    };

    // --- Start: live preview + mic meter + automatic checks --------------------
    const startTest = async () => {
        stopTest();
        const myStartId = startIdRef.current;
        setFaceOk(false); setFaceReason('CHECKING'); faceStreakRef.current = 0; faceOkRef.current = false;
        gazeSamplesRef.current = []; gazeBaselineRef.current = null;
        setVoiceOk(false); setVoiceProgress(0); setVoiceHint(false);
        voiceSecondsRef.current = 0; voiceOkRef.current = false;
        setDeviceCheck({ status: 'checking', message: 'Requesting camera & microphone access...' });
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (myStartId !== startIdRef.current) {
                // The check was stopped while the camera was opening.
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            testStreamRef.current = stream;
            if (testVideoRef.current) testVideoRef.current.srcObject = stream;

            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContextClass();
            audioCtxRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            const samples = new Float32Array(analyser.fftSize);
            const startedAt = performance.now();
            let last = performance.now();

            const updateLevel = () => {
                analyser.getFloatTimeDomainData(samples);
                let sum = 0;
                for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
                const rms = Math.sqrt(sum / samples.length);
                setAudioLevel(Math.min(100, Math.round(rms * 400)));

                const now = performance.now();
                const dt = (now - last) / 1000;
                last = now;
                if (!voiceOkRef.current) {
                    if (rms >= VOICE_RMS_THRESHOLD) voiceSecondsRef.current += dt;
                    const progress = Math.min(1, voiceSecondsRef.current / VOICE_SECONDS_NEEDED);
                    setVoiceProgress(progress);
                    if (progress >= 1) {
                        voiceOkRef.current = true;
                        setVoiceOk(true);
                        setVoiceHint(false);
                    } else if ((now - startedAt) / 1000 > VOICE_HINT_AFTER_SECONDS && voiceSecondsRef.current < 0.3) {
                        setVoiceHint(true);
                    }
                }
                rafRef.current = requestAnimationFrame(updateLevel);
            };
            updateLevel();

            setDeviceCheck({ status: 'success', message: '' });
            startFaceLoop();
        } catch (err) {
            if (myStartId !== startIdRef.current) return; // stopped meanwhile
            console.error("Device check failed:", err);
            setDeviceCheck({
                status: 'error',
                message: 'Could not access camera/microphone. Please allow access in your browser and try again.',
            });
        }
    };

    useEffect(() => {
        startTest();
        return () => stopTest();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const allGood = deviceCheck.status === 'success' && faceOk && voiceOk;

    // "Start Interview" (after passing) or "Skip Test": go to the interview.
    const goToInterview = async () => {
        if (isLaunching) return;
        setIsLaunching(true);
        setStartError('');
        stopTest(); // free the camera/mic so the interview page can open them

        const userId = localStorage.getItem("userId") || 1;
        try {
            const response = await axios.post(`${API}/api/start-interview`, {
                role: sessionRole,
                interviewMode: 'MULTIMODAL',
                userId: parseInt(userId, 10),
                ...(isCustom ? { customQuestions } : {}),
            });
            if (response.data.success) {
                navigate('/interview-session', {
                    replace: true,
                    state: {
                        sessionId: response.data.sessionId,
                        firstQuestion: response.data.firstQuestion,
                        role: sessionRole,
                        difficulty: null,
                        interviewMode: 'MULTIMODAL',
                        totalQuestions: response.data.totalQuestions,
                        // null when the check was skipped -> no personal calibration
                        gazeBaseline: gazeBaselineRef.current,
                    },
                });
                return;
            }
            throw new Error("start-interview failed");
        } catch (error) {
            console.error("Failed to start interview:", error);
            const detail = error?.response?.data?.detail;
            setStartError(
                typeof detail === 'string' ? detail
                    : !error?.response ? "Cannot reach the server. Please check that the backend is running."
                        : "The interview could not be started. Please try again."
            );
            setIsLaunching(false);
            startTest();
        }
    };

    const closeTest = () => {
        stopTest();
        navigate(isCustom ? '/custom-practice' : '/dashboard');
    };

    const faceState = faceOk ? 'ok' : (faceReason === 'CHECKING' ? 'checking' : 'problem');
    const voiceState = voiceOk ? 'ok' : (voiceHint ? 'problem' : 'checking');
    const questionText = isCustom
        ? `Your ${customQuestions.length} Custom Practice questions, read aloud in a random order.`
        : '6 general interview questions, read aloud one by one.';

    return (
        <div>
            <canvas ref={canvasRef} className="hidden" />

            {/* Header */}
            <button
                type="button"
                onClick={closeTest}
                disabled={isLaunching}
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-40"
            >
                <ArrowLeft size={16} />
                {isCustom ? 'Back to Custom practice' : 'Back to dashboard'}
            </button>
            <div className="mt-4">
                <p className="text-sm font-semibold text-blue-600">{isCustom ? 'Custom practice' : 'New interview'}</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Camera &amp; microphone check</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Sit facing the camera and say something. Both checks must pass before the interview can start.
                </p>
            </div>

            {startError && (
                <div role="alert" className="mt-5 flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    {startError}
                </div>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-5">
                {/* Live video preview */}
                <div className="lg:col-span-3">
                    <div
                        className={`relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border-2 bg-slate-900 ${faceOk ? 'border-green-500' : faceState === 'problem' && deviceCheck.status === 'success' ? 'border-amber-400' : 'border-slate-200'
                            }`}
                    >
                        {deviceCheck.status === 'checking' && (
                            <div className="text-center text-slate-300">
                                <Loader2 className="mx-auto animate-spin" size={28} />
                                <p className="mt-2 text-sm">{deviceCheck.message}</p>
                            </div>
                        )}
                        {deviceCheck.status === 'error' && (
                            <div className="px-6 text-center">
                                <XCircle className="mx-auto mb-2 text-red-400" size={28} />
                                <p className="text-sm text-red-200">{deviceCheck.message}</p>
                            </div>
                        )}
                        <video
                            ref={testVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`h-full w-full scale-x-[-1] object-cover ${deviceCheck.status !== 'success' ? 'hidden' : ''}`}
                        />
                        {allGood && (
                            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white">
                                <CheckCircle2 size={14} /> Ready
                            </span>
                        )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                        The preview is mirrored like a selfie. Nothing is recorded on this page.
                    </p>
                </div>

                {/* Checks + start */}
                <div className="space-y-4 lg:col-span-2">
                    {deviceCheck.status === 'success' && (
                        <>
                            <CheckCard state={faceState} icon={Camera} title="Camera">
                                <p className={`mt-1 text-sm ${faceOk ? 'text-green-700' : faceState === 'problem' ? 'text-amber-800' : 'text-slate-500'}`}>
                                    {FACE_MESSAGES[faceReason] || FACE_MESSAGES.CHECKING}
                                </p>
                            </CheckCard>

                            <CheckCard state={voiceState} icon={Mic} title="Microphone">
                                <p className={`mt-1 text-sm ${voiceOk ? 'text-green-700' : voiceHint ? 'text-amber-800' : 'text-slate-500'}`}>
                                    {voiceOk
                                        ? 'We can hear you clearly.'
                                        : voiceHint
                                            ? "We can't hear you. Speak a little louder, or check that the right microphone is selected and not muted."
                                            : <>Say something, for example: <em>"Hello, I'm ready for my interview."</em></>}
                                </p>
                                <div className="mt-3">
                                    <div className="flex justify-between text-[11px] text-slate-500">
                                        <span>Input level</span>
                                        {!voiceOk && <span>{Math.round(voiceProgress * 100)}% heard</span>}
                                    </div>
                                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                                        <div className="h-full rounded-full bg-green-500 transition-all duration-100" style={{ width: `${audioLevel}%` }} />
                                    </div>
                                    {!voiceOk && (
                                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round(voiceProgress * 100)}%` }} />
                                        </div>
                                    )}
                                </div>
                            </CheckCard>
                        </>
                    )}

                    {/* What happens next */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                            <Info size={15} className="text-blue-600" /> What happens next
                        </p>
                        <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                            <li>{questionText}</li>
                            <li>Your camera measures eye contact and head position; your microphone measures speech rate, pauses and pitch.</li>
                            <li className="flex items-start gap-1.5">
                                <Keyboard size={15} className="mt-0.5 shrink-0 text-slate-400" />
                                <span>The interview uses the keyboard: <b>Enter</b> to start and answer, <b>Space</b> to hear a question again.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3">
                        {deviceCheck.status === 'error' ? (
                            <button
                                type="button"
                                onClick={startTest}
                                disabled={isLaunching}
                                className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                            >
                                Try again
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={goToInterview}
                                disabled={!allGood || isLaunching}
                                title={allGood ? '' : 'Finish the camera and microphone check first'}
                                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                            >
                                {isLaunching
                                    ? <><Loader2 size={16} className="animate-spin" /> Starting...</>
                                    : <>Start interview <ArrowRight size={16} /></>}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={goToInterview}
                            disabled={isLaunching}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                        >
                            Skip check
                        </button>
                    </div>
                    {!allGood && deviceCheck.status === 'success' && (
                        <p className="text-xs text-slate-500">
                            Skipping the check means no personal eye-contact calibration for this interview.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InterviewSetup;