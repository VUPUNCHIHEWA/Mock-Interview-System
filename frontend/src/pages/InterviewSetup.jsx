import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Info, Mic, Camera, XCircle, X, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';

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
// Only when both pass does the "Start Interview" button turn green.
// "Skip Test" is still available.
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
    if (state === 'ok') return <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />;
    if (state === 'problem') return <AlertTriangle size={18} className="text-orange-500 shrink-0" />;
    return <Loader2 size={18} className="animate-spin text-slate-400 shrink-0" />;
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
            alert(error?.response?.data?.detail || "Failed to initialize the interview session. Please try again.");
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

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <canvas ref={canvasRef} className="hidden" />
            <div className="bg-white rounded-[2.5rem] p-7 max-w-md w-full shadow-2xl relative my-auto">
                <button
                    onClick={closeTest}
                    disabled={isLaunching}
                    className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40"
                    aria-label="Close and go back to the dashboard"
                >
                    <X size={20} />
                </button>

                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1">Camera &amp; Microphone Check</h3>
                <p className="text-xs text-slate-400 font-medium mb-4">
                    Sit facing the camera and say something. We'll check that both work for the interview.
                </p>

                {/* Live video preview */}
                <div className={`w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden mb-4 flex items-center justify-center border-2 ${faceOk ? 'border-emerald-400' : faceState === 'problem' ? 'border-orange-400' : 'border-transparent'}`}>
                    {deviceCheck.status === 'checking' && <Loader2 className="animate-spin text-white" size={28} />}
                    {deviceCheck.status === 'error' && (
                        <div className="text-center px-6">
                            <XCircle className="mx-auto text-red-400 mb-2" size={28} />
                            <p className="text-red-300 text-xs font-bold">{deviceCheck.message}</p>
                        </div>
                    )}
                    <video
                        ref={testVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover scale-x-[-1] ${deviceCheck.status !== 'success' ? 'hidden' : ''}`}
                    />
                </div>

                {deviceCheck.status === 'success' && (
                    <div className="space-y-3 mb-4">
                        {/* Camera check */}
                        <div className={`rounded-2xl border p-3 ${faceOk ? 'border-emerald-200 bg-emerald-50/60' : faceState === 'problem' ? 'border-orange-200 bg-orange-50/60' : 'border-slate-100 bg-slate-50'}`}>
                            <div className="flex items-start gap-2">
                                <StatusIcon state={faceState} />
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1.5"><Camera size={13} /> Camera</p>
                                    <p className={`text-xs font-semibold mt-0.5 ${faceOk ? 'text-emerald-700' : faceState === 'problem' ? 'text-orange-700' : 'text-slate-500'}`}>
                                        {FACE_MESSAGES[faceReason] || FACE_MESSAGES.CHECKING}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Microphone check */}
                        <div className={`rounded-2xl border p-3 ${voiceOk ? 'border-emerald-200 bg-emerald-50/60' : voiceHint ? 'border-orange-200 bg-orange-50/60' : 'border-slate-100 bg-slate-50'}`}>
                            <div className="flex items-start gap-2">
                                <StatusIcon state={voiceState} />
                                <div className="flex-1">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1.5"><Mic size={13} /> Microphone</p>
                                    <p className={`text-xs font-semibold mt-0.5 ${voiceOk ? 'text-emerald-700' : voiceHint ? 'text-orange-700' : 'text-slate-500'}`}>
                                        {voiceOk
                                            ? 'We can hear you clearly.'
                                            : voiceHint
                                                ? "We can't hear you. Speak a little louder, or check that the right microphone is selected and not muted."
                                                : <>Say something, for example: <em>"Hello, I'm ready for my interview."</em></>}
                                    </p>
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-2">
                                        <div className="h-full bg-green-400 transition-all duration-100 rounded-full" style={{ width: `${audioLevel}%` }}></div>
                                    </div>
                                    {!voiceOk && (
                                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.round(voiceProgress * 100)}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {allGood && (
                            <div className="rounded-2xl bg-emerald-500 text-white text-xs font-black uppercase tracking-widest text-center py-2.5">
                                ✓ All good - you're ready
                            </div>
                        )}
                    </div>
                )}

                {/* What the session analyses */}
                <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3 mb-4 flex gap-2 items-start">
                    <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-blue-900/80 font-medium leading-relaxed">
                        {isCustom
                            ? `Custom Practice: your ${customQuestions.length} questions, read aloud in a random order.`
                            : '6 general questions, read aloud.'} Your camera measures eye contact &amp; head pose, and your
                        microphone measures speaking speed, pauses and pitch. Press <strong>Enter</strong> on the next
                        screen to begin.
                    </p>
                </div>

                <div className="flex gap-3">
                    {deviceCheck.status === 'error' ? (
                        <button
                            onClick={startTest}
                            disabled={isLaunching}
                            className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60"
                        >
                            Try Again
                        </button>
                    ) : (
                        <button
                            onClick={goToInterview}
                            disabled={!allGood || isLaunching}
                            title={allGood ? '' : 'Finish the camera and microphone check first'}
                            className={`flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${allGood
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 shadow-lg shadow-emerald-200'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        >
                            {isLaunching ? <><Loader2 size={14} className="animate-spin" /> Starting...</> : <>Start Interview <ChevronRight size={14} /></>}
                        </button>
                    )}
                    <button
                        onClick={goToInterview}
                        disabled={isLaunching}
                        className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1"
                    >
                        Skip Test
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InterviewSetup;