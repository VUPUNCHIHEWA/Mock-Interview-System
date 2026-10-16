import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import FocusInterviewSession from './FocusInterviewSession';
import { Camera, Mic, Send, AlertTriangle, CheckCircle, User, Bot, Loader2, ChevronDown, ChevronUp, StopCircle, PartyPopper, SkipForward, RotateCcw, Play } from 'lucide-react';

// Classic chat-style interview screen - now used for TEXT mode only.
// Voice + camera (MULTIMODAL) interviews use the distraction-free,
// keyboard-controlled FocusInterviewSession screen instead (see bottom).
const ClassicInterviewSession = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const { sessionId, firstQuestion, role, difficulty, github, cvStatus, interviewMode } = location.state || {
        sessionId: "demo_session",
        firstQuestion: null,
        role: "Software QA Engineer",
        difficulty: "Medium",
        github: "N/A",
        cvStatus: false,
        interviewMode: "MULTIMODAL"
    };

    const [userAnswer, setUserAnswer] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [cameraError, setCameraError] = useState(false);
    const [isWaitingForAi, setIsWaitingForAi] = useState(false);
    const [isEnding, setIsEnding] = useState(false);
    const [expandedFeedback, setExpandedFeedback] = useState({});
    const [visualMetrics, setVisualMetrics] = useState({
        score: null, gaze: null, head: null, emotion: "Neutral",
        eyeContactStatus: "UNKNOWN", headPoseStatus: "UNKNOWN", warning: null
    });
    const [scoreAccumulator, setScoreAccumulator] = useState({ total: 0, count: 0 });
    const [sessionComplete, setSessionComplete] = useState(false);
    const [isLastQuestion, setIsLastQuestion] = useState(false);

    // --- BSc Research Feature (Suggestions #1-#7): additional UX/data-quality features ---
    const [isSkipping, setIsSkipping] = useState(false); // Suggestion #1: Skip Question
    const [elapsedSeconds, setElapsedSeconds] = useState(0); // Suggestion #3: Session timer
    const [recordingSeconds, setRecordingSeconds] = useState(0); // Suggestion #6: min-recording-duration tracking
    const [pendingAudioBlob, setPendingAudioBlob] = useState(null); // Suggestion #7: Re-record (listen-back before submit)
    const [pendingAudioUrl, setPendingAudioUrl] = useState(null);
    const recordingTimerRef = useRef(null);
    const sessionTimerRef = useRef(null);

    // --- ASSUMPTION - not literature-derived: minimum recording duration
    // (5 seconds) below which filler-word/pause/pitch metrics are
    // considered too short to be statistically meaningful, and the
    // student is warned before submitting. This is a researcher-set
    // data-quality threshold, not sourced from a specific paper.
    const MIN_RECORDING_SECONDS = 5;

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const chatEndRef = useRef(null);
    const canvasRef = useRef(null);
    const captureIntervalRef = useRef(null);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef("");

    const [chatHistory, setChatHistory] = useState([
        {
            sender: "ai",
            text: `Welcome to your AI Mock Interview! I have analyzed your background. Let's start the ${role} (${difficulty} level) session. Here is your first question:`
        },
        {
            sender: "ai",
            text: firstQuestion || (role.includes("QA")
                ? "Can you explain the difference between Smoke Testing and Sanity Testing with a practical example?"
                : "Explain how Dependency Injection works in Spring Boot and why we use it.")
        }
    ]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    // --- BSc Research Feature (Suggestion #3): session elapsed-time
    // timer, starts on mount, stops once the session is complete.
    useEffect(() => {
        if (!sessionComplete) {
            sessionTimerRef.current = setInterval(() => {
                setElapsedSeconds(prev => prev + 1);
            }, 1000);
        } else {
            if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
        }
        return () => {
            if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
        };
    }, [sessionComplete]);

    const formatTime = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const secs = (totalSeconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    // Gap (ms) between one frame's result arriving and the next frame being
    // sent. The next frame is only sent AFTER the previous result comes
    // back, so requests can never pile up in a queue (the old fixed
    // 2500 ms setInterval did not wait, which built a backlog and made the
    // bar show results ~15 s late).
    const VISUAL_CAPTURE_GAP_MS = 1000;

    // Returns a promise that settles when this frame's analysis is done.
    // isCancelled() lets a late response be ignored after the camera was
    // turned off or the session ended.
    const captureVisualFrame = (isCancelled = () => false) => {
        if (videoRef.current && canvasRef.current && isCameraOn) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            canvas.width = video.videoWidth || 400;
            canvas.height = video.videoHeight || 400;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const base64Frame = canvas.toDataURL('image/jpeg', 0.6);

            return axios.post("http://localhost:8000/api/analyze-visual", {
                sessionId: sessionId,
                image_base64: base64Frame
            }).then(response => {
                if (isCancelled()) return;
                const data = response.data;
                if (data.status && data.status !== "ERROR" && data.status !== "SKIPPED") {
                    setVisualMetrics({
                        score: data.visual_confidence_score,
                        gaze: data.gaze_score,
                        head: data.head_stability_score,
                        eyeContactStatus: data.eye_contact_status,
                        headPoseStatus: data.head_pose_status,
                        warning: data.warning_message
                    });

                    if (data.status === "FACE_DETECTED") {
                        setScoreAccumulator(prev => ({
                            total: prev.total + data.visual_confidence_score,
                            count: prev.count + 1
                        }));
                    }
                }
            }).catch(err => console.error("Visual API Error:", err));
        }
        return Promise.resolve();
    };

    useEffect(() => {
        if (!(isCameraOn && interviewMode === "MULTIMODAL" && !sessionComplete)) {
            if (captureIntervalRef.current) clearTimeout(captureIntervalRef.current);
            return;
        }

        let cancelled = false;
        const isCancelled = () => cancelled;

        // Self-scheduling loop: send one frame, wait for its result, then
        // wait VISUAL_CAPTURE_GAP_MS before sending the next one.
        const loop = async () => {
            if (cancelled) return;
            await captureVisualFrame(isCancelled);
            if (!cancelled) {
                captureIntervalRef.current = setTimeout(loop, VISUAL_CAPTURE_GAP_MS);
            }
        };
        captureIntervalRef.current = setTimeout(loop, VISUAL_CAPTURE_GAP_MS);

        return () => {
            cancelled = true;
            if (captureIntervalRef.current) clearTimeout(captureIntervalRef.current);
        };
    }, [isCameraOn, interviewMode, sessionComplete]);

    const startAudioRecording = (stream) => {
        try {
            audioChunksRef.current = [];
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.error("[Vocal Log] No audio tracks found in stream.");
                return;
            }
            const audioOnlyStream = new MediaStream(audioTracks);
            let options = { mimeType: 'audio/webm;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'audio/webm' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'audio/ogg;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'audio/mp4' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) options = {};

            const mediaRecorder = new MediaRecorder(audioOnlyStream, options);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === "inactive") {
                    mediaRecorderRef.current.start(1000);
                }
            }, 500);
        } catch (err) {
            console.error("Failed to start Audio Recording:", err);
        }
    };

    const startWebcam = async (includeVideo = true) => {
        try {
            setCameraError(false);
            const constraints = {
                video: includeVideo ? { width: 400, height: 400, facingMode: "user" } : false,
                audio: true
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current && includeVideo) {
                videoRef.current.srcObject = stream;
            }
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !isMuted;
            }
        } catch (err) {
            console.error("Error accessing hardware:", err);
            setCameraError(true);
        }
    };

    useEffect(() => {
        if (interviewMode === "MULTIMODAL") {
            startWebcam(true);
        }
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
        };
    }, [interviewMode]);

    const toggleCamera = async () => {
        if (isCameraOn) {
            if (streamRef.current) {
                const videoTrack = streamRef.current.getVideoTracks()[0];
                if (videoTrack) videoTrack.stop();
            }
            setIsCameraOn(false);
            setVisualMetrics({
                score: null, gaze: null, head: null,
                eyeContactStatus: "UNKNOWN", headPoseStatus: "UNKNOWN",
                warning: "Camera is off - no visual data being recorded."
            });
        } else {
            await startWebcam(true);
            setIsCameraOn(true);
        }
    };

    const toggleMute = () => {
        if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const handleStartRecording = () => {
        if (!streamRef.current) {
            alert("Microphone not available.");
            return;
        }
        startAudioRecording(streamRef.current);
        setIsRecording(true);
        setRecordingSeconds(0);

        // Suggestion #6: track recording duration live
        recordingTimerRef.current = setInterval(() => {
            setRecordingSeconds(prev => prev + 1);
        }, 1000);

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            finalTranscriptRef.current = userAnswer.trim() ? userAnswer.trim() + " " : "";

            recognition.onresult = (event) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscriptRef.current += event.results[i][0].transcript + " ";
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                setUserAnswer(finalTranscriptRef.current + interimTranscript);
            };

            recognition.onerror = (e) => console.error("Speech Recognition Error:", e);
            try {
                recognition.start();
                recognitionRef.current = recognition;
            } catch (err) {
                console.error("Speech recognition failed to start:", err);
            }
        }
    };

    // --- BSc Research Feature (Suggestions #6 & #7): instead of
    // immediately submitting the recorded audio, we now store it as a
    // "pending" blob so the student can listen back and re-record if
    // needed, and warn them if the recording is shorter than the
    // minimum duration needed for reliable filler/pause/pitch metrics.
    const handleStopAndSend = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType || 'audio/webm' });
                setPendingAudioBlob(audioBlob);
                setPendingAudioUrl(URL.createObjectURL(audioBlob));
            };
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleReRecord = () => {
        if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
        setPendingAudioBlob(null);
        setPendingAudioUrl(null);
        setRecordingSeconds(0);
    };

    const handleConfirmSubmitRecording = async () => {
        if (!pendingAudioBlob) return;
        const blobToSubmit = pendingAudioBlob;
        if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
        setPendingAudioBlob(null);
        setPendingAudioUrl(null);
        await submitAudioAnswer(blobToSubmit);
    };

    const getAvgScore = () => {
        if (scoreAccumulator.count === 0) return null;
        const avg = scoreAccumulator.total / scoreAccumulator.count;
        setScoreAccumulator({ total: 0, count: 0 });
        return Math.round(avg * 10) / 10;
    };

    const processAnswerResponse = (responseData) => {
        if (responseData.sessionComplete) {
            setChatHistory(prev => [...prev, {
                sender: "ai",
                text: "🎉 You've completed all 6 questions! Click \"End Interview\" above to see your full performance report.",
                evaluation: responseData.evaluation,
                isSessionCompleteMessage: true,
            }]);
            setSessionComplete(true);
            setIsLastQuestion(false);
        } else {
            setChatHistory(prev => [...prev, {
                sender: "ai",
                text: responseData.nextQuestion,
                evaluation: responseData.evaluation,
            }]);
            setIsLastQuestion(!!responseData.isLastQuestion);
        }
    };

    const submitAudioAnswer = async (audioBlob) => {
        setIsWaitingForAi(true);
        const currentAnswer = userAnswer.trim() || "🎙️ [Audio Response]";
        const newUserMessage = { sender: "user", text: currentAnswer };
        setChatHistory(prev => [...prev, newUserMessage]);
        setUserAnswer("");

        const formData = new FormData();
        formData.append("sessionId", sessionId);
        formData.append("message", currentAnswer);
        formData.append("audio_file", audioBlob, `vocal_${sessionId}.webm`);

        const avgScore = getAvgScore();
        if (avgScore !== null) {
            formData.append("visualConfidenceScore", avgScore);
        }

        try {
            const response = await axios.post("http://localhost:8000/api/chat-interview", formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                processAnswerResponse(response.data);
            } else {
                if (response.data.limit_exceeded) {
                    alert(response.data.message || "Gemini API limit exceeded.");
                    setChatHistory(prev => [...prev, { sender: "ai", text: "Gemini API limit exceeded. Please try again later." }]);
                } else {
                    setChatHistory(prev => [...prev, { sender: "ai", text: "Sorry, I couldn't process that response." }]);
                }
            }
        } catch (error) {
            console.error("Failed to communicate with backend:", error);
            setChatHistory(prev => [...prev, { sender: "ai", text: "Connection error." }]);
        } finally {
            setIsWaitingForAi(false);
        }
    };

    // --- BSc Research Feature (Suggestion #1): Skip Question - lets the
    // student move past a question they cannot answer, rather than being
    // blocked. Bypasses audio/Gemini processing entirely (backend saves
    // "[Skipped by student]", score=0, excluded from the score average).
    const handleSkipQuestion = async () => {
        if (!window.confirm("Skip this question? It will be marked as skipped and won't count toward your score.")) return;
        setIsSkipping(true);
        setIsWaitingForAi(true);

        setChatHistory(prev => [...prev, { sender: "user", text: "[Skipped this question]" }]);
        setUserAnswer("");
        if (isRecording) handleStopAndSend();

        try {
            const response = await axios.post("http://localhost:8000/api/chat-interview", {
                sessionId: sessionId,
                message: "",
                skipQuestion: true,
            }, { headers: { 'Content-Type': 'application/json' } });

            if (response.data.success) {
                processAnswerResponse(response.data);
            } else {
                setChatHistory(prev => [...prev, { sender: "ai", text: "Sorry, I couldn't process that." }]);
            }
        } catch (error) {
            console.error("Failed to skip question:", error);
            setChatHistory(prev => [...prev, { sender: "ai", text: "Connection error while skipping." }]);
        } finally {
            setIsWaitingForAi(false);
            setIsSkipping(false);
        }
    };

    const handleAnswerSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!userAnswer.trim() || isWaitingForAi || sessionComplete) return;

        const currentAnswer = userAnswer;
        setUserAnswer("");

        const newUserMessage = { sender: "user", text: currentAnswer };
        setChatHistory(prev => [...prev, newUserMessage]);
        setIsWaitingForAi(true);

        const payload = {
            sessionId: sessionId,
            message: currentAnswer
        };
        const avgScore = getAvgScore();
        if (avgScore !== null) {
            payload.visualConfidenceScore = avgScore;
        }

        try {
            const response = await axios.post("http://localhost:8000/api/chat-interview", payload, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.data.success) {
                processAnswerResponse(response.data);
            } else {
                if (response.data.limit_exceeded) {
                    alert(response.data.message || "Gemini API limit exceeded.");
                    setChatHistory(prev => [...prev, { sender: "ai", text: "Gemini API limit exceeded. Please try again later." }]);
                } else {
                    setChatHistory(prev => [...prev, { sender: "ai", text: "Sorry, I couldn't process that response." }]);
                }
            }
        } catch (error) {
            console.error("Failed to communicate with backend:", error);
            setChatHistory(prev => [...prev, { sender: "ai", text: "Connection error. Please check your backend server." }]);
        } finally {
            setIsWaitingForAi(false);
        }
    };

    const handleEndInterview = async () => {
        if (!sessionComplete && !window.confirm("Are you sure you want to end the interview? You haven't answered all 6 questions yet.")) return;
        setIsEnding(true);
        try {
            const response = await axios.post("http://localhost:8000/api/end-interview", { sessionId });
            if (response.data.success) {
                navigate('/interview-results', { state: { results: response.data } });
            }
        } catch (error) {
            console.error("Failed to end interview:", error);
            alert("Error ending the interview.");
        } finally {
            setIsEnding(false);
        }
    };

    const toggleFeedback = (index) => {
        setExpandedFeedback(prev => ({ ...prev, [index]: !prev[index] }));
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 flex flex-col">
            <canvas ref={canvasRef} className="hidden" />

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-wrap justify-between items-center gap-4 shadow-xl">
                <div>
                    <span className="text-[10px] font-black tracking-widest text-blue-400 uppercase">Live Session</span>
                    <h2 className="text-xl font-black uppercase tracking-tight italic">{role}</h2>
                </div>
                <div className="flex gap-3 text-xs items-center">
                    <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                        <span className="text-slate-400">Level:</span> <strong className="text-orange-400">{difficulty}</strong>
                    </div>
                    <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                        <span className="text-slate-400">Time:</span> <strong className="text-blue-400">{formatTime(elapsedSeconds)}</strong>
                    </div>
                    <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                        <span className="text-slate-400">GitHub:</span> <strong className="text-green-400">{github}</strong>
                    </div>
                    <button
                        onClick={handleEndInterview}
                        disabled={isEnding}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${sessionComplete ? 'bg-green-600 hover:bg-green-500 animate-pulse' : 'bg-red-600 hover:bg-red-500'
                            }`}
                    >
                        {isEnding ? <Loader2 className="animate-spin" size={14} /> : <StopCircle size={14} />} End Interview
                    </button>
                </div>
            </div>

            {isLastQuestion && !sessionComplete && (
                <div className="mb-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl p-3 text-center text-orange-300 text-xs font-bold uppercase tracking-widest">
                    ⏳ This is your final question - answer it, then click "End Interview" to see your report.
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                <div className="lg:col-span-8 bg-slate-900 rounded-[2rem] border border-slate-800 p-6 flex flex-col h-[70vh] shadow-2xl">
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
                        {chatHistory.map((msg, index) => (
                            <div key={index} className="flex flex-col mb-4">
                                <div className={`flex items-start gap-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                                    <div className={`p-2 rounded-xl border ${msg.sender === 'user' ? 'bg-blue-600 border-blue-500 text-white' :
                                            msg.isSessionCompleteMessage ? 'bg-green-600 border-green-500 text-white' :
                                                'bg-slate-800 border-slate-700 text-blue-400'
                                        }`}>
                                        {msg.sender === 'user' ? <User size={18} /> : (msg.isSessionCompleteMessage ? <PartyPopper size={18} /> : <Bot size={18} />)}
                                    </div>
                                    <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-md ${msg.sender === 'user' ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100 rounded-tr-none' :
                                            msg.isSessionCompleteMessage ? 'bg-green-600/20 border border-green-500/30 text-green-100 rounded-tl-none' :
                                                'bg-slate-800/50 border border-slate-850 text-slate-200 rounded-tl-none'
                                        }`}>
                                        {msg.text}
                                    </div>
                                </div>
                                {msg.evaluation && (
                                    <div className={`mt-2 ml-14 max-w-[70%] bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden transition-all`}>
                                        <button
                                            onClick={() => toggleFeedback(index)}
                                            className="w-full flex items-center justify-between p-3 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
                                        >
                                            <span className="flex items-center gap-2">
                                                {msg.evaluation.score !== null && msg.evaluation.score !== undefined ? (
                                                    <>
                                                        <div className={`w-2 h-2 rounded-full ${msg.evaluation.score >= 80 ? 'bg-green-400' : msg.evaluation.score >= 60 ? 'bg-orange-400' : 'bg-red-400'}`}></div>
                                                        Instant Feedback (Score: {msg.evaluation.score})
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                                                        Instant Feedback (Not Evaluated)
                                                    </>
                                                )}
                                            </span>
                                            {expandedFeedback[index] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                        {expandedFeedback[index] && (
                                            <div className="p-4 pt-0 text-sm text-slate-300 italic border-t border-slate-700/50">
                                                {msg.evaluation.feedback}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {isWaitingForAi && (
                            <div className="flex items-start gap-3 max-w-[85%]">
                                <div className="p-2 rounded-xl border bg-slate-800 border-slate-700 text-blue-400"><Bot size={18} /></div>
                                <div className="p-4 rounded-2xl text-sm font-medium bg-slate-800/30 border border-slate-850 text-slate-400 rounded-tl-none flex items-center gap-2">
                                    <Loader2 className="animate-spin text-blue-500" size={16} />
                                    <span>Gemini is analyzing your vocal & textual response...</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {sessionComplete ? (
                        <div className="mt-auto bg-green-600/10 border border-green-600/30 rounded-2xl p-6 text-center">
                            <PartyPopper className="mx-auto text-green-400 mb-2" size={28} />
                            <p className="text-green-200 font-bold text-sm mb-4">All 6 questions answered! Ready to see your results?</p>
                            <button
                                onClick={handleEndInterview}
                                disabled={isEnding}
                                className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {isEnding ? <Loader2 className="animate-spin" size={14} /> : <StopCircle size={14} />} End Interview & View Report
                            </button>
                        </div>
                    ) : (
                        <div className="mt-auto flex flex-col gap-2">
                            {/* Suggestion #7: Re-record / Listen-back UI - shown after
                            stopping a recording, before it's actually submitted */}
                            {pendingAudioUrl ? (
                                <div className="bg-slate-800/50 border border-blue-700/50 p-4 rounded-2xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                                            <Play size={14} className="text-blue-400" /> Review your recording ({recordingSeconds}s)
                                        </span>
                                        {recordingSeconds < MIN_RECORDING_SECONDS && (
                                            <span className="text-[10px] text-orange-400 font-bold uppercase">⚠️ Very short - consider re-recording</span>
                                        )}
                                    </div>
                                    <audio controls src={pendingAudioUrl} className="w-full h-9" />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleReRecord}
                                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                                        >
                                            <RotateCcw size={14} /> Re-record
                                        </button>
                                        <button
                                            onClick={handleConfirmSubmitRecording}
                                            disabled={isWaitingForAi}
                                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <Send size={14} /> Submit This Answer
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {interviewMode === "MULTIMODAL" && (
                                        <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700 p-3 rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <Mic size={20} className={isRecording ? "text-red-500 animate-pulse" : "text-slate-400"} />
                                                <span className="text-sm font-bold text-slate-300">
                                                    {isRecording ? `Recording... ${recordingSeconds}s` : "Voice Answer"}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                {userAnswer.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setUserAnswer(""); finalTranscriptRef.current = ""; }}
                                                        disabled={isWaitingForAi}
                                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                                                    >
                                                        Clear Text
                                                    </button>
                                                )}
                                                {!isRecording ? (
                                                    <button
                                                        onClick={handleStartRecording}
                                                        disabled={isWaitingForAi}
                                                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                                    >
                                                        Start Recording
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={handleStopAndSend}
                                                        disabled={isWaitingForAi || userAnswer.trim().split(/\s+/).filter(w => w.length > 0).length < 4}
                                                        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                                    >
                                                        <StopCircle size={14} /> Stop Recording
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <form onSubmit={handleAnswerSubmit} className="relative">
                                        <textarea
                                            value={userAnswer}
                                            onChange={(e) => setUserAnswer(e.target.value)}
                                            disabled={isWaitingForAi}
                                            placeholder={isWaitingForAi ? "Please wait until Gemini responds..." : "Type your detailed answer here... (Live transcribed text will appear here)"}
                                            rows="2"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-5 pr-16 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all disabled:opacity-50"
                                        />
                                        <button type="submit" disabled={isWaitingForAi || isRecording || userAnswer.trim().split(/\s+/).filter(w => w.length > 0).length < 4} className="absolute right-3 bottom-4 bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-500 active:scale-95 transition-all disabled:bg-slate-800">
                                            <Send size={16} />
                                        </button>
                                    </form>
                                    {/* Suggestion #2: live word-count indicator */}
                                    <div className="flex justify-between items-center px-2">
                                        <div>
                                            {userAnswer.trim().length > 0 && userAnswer.trim().split(/\s+/).filter(w => w.length > 0).length < 4 && (
                                                <p className="text-[10px] text-orange-400 font-bold">Please write a detailed technical answer to enable submission.</p>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-bold">
                                            {userAnswer.trim() ? userAnswer.trim().split(/\s+/).filter(w => w.length > 0).length : 0} words
                                        </span>
                                    </div>
                                    {/* Suggestion #1: Skip Question button */}
                                    <button
                                        type="button"
                                        onClick={handleSkipQuestion}
                                        disabled={isWaitingForAi || isSkipping}
                                        className="self-center mt-1 text-slate-500 hover:text-slate-300 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors disabled:opacity-40"
                                    >
                                        <SkipForward size={12} /> Skip this question
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-4 space-y-6">
                    {interviewMode === "MULTIMODAL" ? (
                        <>
                            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-4 shadow-xl overflow-hidden relative aspect-video lg:aspect-square flex flex-col justify-center items-center">
                                {!cameraError ? (
                                    <div className="w-full h-full rounded-2xl bg-slate-950 border border-slate-850 relative overflow-hidden flex items-center justify-center">
                                        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover rounded-2xl scale-x-[-1] ${!isCameraOn ? 'hidden' : ''}`} />
                                        {/* Suggestion #4: Face-frame guide overlay - helps students
                                            position themselves correctly for reliable face detection */}
                                        {isCameraOn && !visualMetrics.warning && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
                                                <div className="w-[55%] h-[70%] border-2 border-dashed border-white/25 rounded-[40%]"></div>
                                            </div>
                                        )}
                                        {!isCameraOn && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950">
                                                <User size={48} className="text-slate-800 animate-pulse" />
                                                <span className="text-[11px] font-bold text-slate-500 mt-2">Camera Hardware Off</span>
                                            </div>
                                        )}
                                        <div className="absolute top-3 left-3 bg-red-600 text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-widest animate-pulse flex items-center gap-1 z-10">
                                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span> {isMuted ? "REC - MUTED" : "LIVE REC"}
                                        </div>
                                        {interviewMode === "MULTIMODAL" && (
                                            <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2 z-10">
                                                {/* Suggestion #5: made more visually prominent (larger, icon,
                                                    stronger contrast) than the original small red banner */}
                                                {visualMetrics.warning && (
                                                    <div className="bg-red-600 text-white text-xs font-black uppercase tracking-widest p-3 rounded-xl text-center animate-pulse border-2 border-red-400 shadow-2xl flex items-center justify-center gap-2">
                                                        <AlertTriangle size={16} /> {visualMetrics.warning}
                                                    </div>
                                                )}

                                                <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/50 rounded-xl p-3 flex flex-col gap-3 shadow-xl">
                                                    <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Visual Confidence</span>
                                                        <span className={`text-xs font-black ${visualMetrics.score >= 75 ? 'text-green-400' : visualMetrics.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                            {visualMetrics.score !== null ? `${visualMetrics.score}%` : 'Evaluating...'}
                                                        </span>
                                                    </div>

                                                    {visualMetrics.score !== null && (
                                                        <>
                                                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                                <div
                                                                    className={`h-full transition-all duration-500 ${visualMetrics.score >= 75 ? 'bg-green-400' : visualMetrics.score >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                                                    style={{ width: `${visualMetrics.score}%` }}
                                                                ></div>
                                                            </div>
                                                            <div className="flex justify-between mt-1 gap-2">
                                                                <div className={`flex-1 p-2 rounded-lg text-center border ${visualMetrics.eyeContactStatus === 'GOOD' ? 'bg-green-500/20 border-green-500/30 text-green-300' : visualMetrics.eyeContactStatus === 'WANDERING' ? 'bg-orange-500/20 border-orange-500/30 text-orange-300' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                                                                    <span className="text-[9px] font-bold uppercase block tracking-wider">👁️ Eye Contact</span>
                                                                    <span className="text-[10px] font-black">{visualMetrics.eyeContactStatus === 'GOOD' ? 'Good' : visualMetrics.eyeContactStatus === 'WANDERING' ? 'Wandering' : '--'}</span>
                                                                </div>
                                                                <div className={`flex-1 p-2 rounded-lg text-center border ${visualMetrics.headPoseStatus === 'STABLE' ? 'bg-green-500/20 border-green-500/30 text-green-300' : visualMetrics.headPoseStatus === 'EXCESSIVE_MOVEMENT' ? 'bg-orange-500/20 border-orange-500/30 text-orange-300' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                                                                    <span className="text-[9px] font-bold uppercase block tracking-wider">🗣️ Head Pose</span>
                                                                    <span className="text-[10px] font-black">{visualMetrics.headPoseStatus === 'STABLE' ? 'Stable' : visualMetrics.headPoseStatus === 'EXCESSIVE_MOVEMENT' ? 'Unstable' : '--'}</span>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center p-6">
                                        <AlertTriangle className="mx-auto text-orange-500 mb-2" size={32} />
                                        <p className="text-xs text-slate-400 font-bold uppercase">Webcam Access Denied</p>
                                    </div>
                                )}

                                <div className="flex gap-3 mt-4 w-full justify-center">
                                    <button onClick={toggleCamera} className={`p-3 rounded-xl border text-xs font-bold transition-all active:scale-95 flex-1 flex items-center justify-center gap-2 ${isCameraOn ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-red-950/40 text-red-400'}`}>
                                        <Camera size={16} /> {isCameraOn ? "Turn Off" : "Turn On"}
                                    </button>
                                    <button onClick={toggleMute} className={`p-3 rounded-xl border text-xs font-bold transition-all active:scale-95 flex-1 flex items-center justify-center gap-2 ${!isMuted ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-red-950/40 text-red-400'}`}>
                                        <Mic size={16} /> {!isMuted ? "Mute Mic" : "Unmute Mic"}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-blue-950/20 border border-blue-900/30 rounded-2xl p-4 text-xs flex gap-3 items-start">
                                <CheckCircle className="text-blue-400 shrink-0 mt-0.5" size={16} />
                                <p className="text-blue-200/80 leading-relaxed">
                                    <strong>Multimodal Framework Note:</strong> Keep your camera centered. The AI system will evaluate behavioral indicators, facial parameters, and structural confidence markers.
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-xl flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                            <Bot size={64} className="text-blue-500 mb-6 opacity-50" />
                            <h3 className="text-lg font-black uppercase tracking-widest text-slate-300 mb-2">Text Mode Active</h3>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                Camera and microphone are disabled.<br />Focus on providing detailed written responses.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const InterviewSession = () => {
    const location = useLocation();
    const interviewMode = (location.state && location.state.interviewMode) || "MULTIMODAL";
    return interviewMode === "MULTIMODAL" ? <FocusInterviewSession /> : <ClassicInterviewSession />;
};

export default InterviewSession;