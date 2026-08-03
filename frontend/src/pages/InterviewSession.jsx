import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Camera, Mic, Send, AlertTriangle, CheckCircle, User, Bot, Loader2, ChevronDown, ChevronUp, StopCircle } from 'lucide-react';

const InterviewSession = () => {
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

    // States
    const [userAnswer, setUserAnswer] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [cameraError, setCameraError] = useState(false);
    const [isWaitingForAi, setIsWaitingForAi] = useState(false);
    const [isEnding, setIsEnding] = useState(false);
    const [expandedFeedback, setExpandedFeedback] = useState({});
    const [visualMetrics, setVisualMetrics] = useState({ score: null, emotion: "Neutral" });

    // Refs
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const chatEndRef = useRef(null);
    const canvasRef = useRef(null); 
    const captureIntervalRef = useRef(null); 

    // 🎙️ Audio Recording Refs
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

    // 📸 Visual Frame Capture Logic (1-second intervals)
    const captureVisualFrame = () => {
        if (videoRef.current && canvasRef.current && isCameraOn) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            canvas.width = video.videoWidth || 400;
            canvas.height = video.videoHeight || 400;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const base64Frame = canvas.toDataURL('image/jpeg', 0.6);
            console.log(`[Visual Log] Frame Captured for Session: ${sessionId}`, base64Frame.substring(0, 60) + "...");
            
            
            axios.post("http://localhost:8000/api/analyze-visual", {
                sessionId: sessionId,
                frame: base64Frame
            }).then(response => {
                if(response.data.success && response.data.confidenceScore !== undefined) {
                    setVisualMetrics({
                        score: response.data.confidenceScore,
                        emotion: response.data.emotion
                    });
                }
            }).catch(err => console.error("Visual API Error:", err));
        }
    };

    useEffect(() => {
        if (isCameraOn && interviewMode === "MULTIMODAL") {
            captureIntervalRef.current = setInterval(captureVisualFrame, 1000);
        } else {
            if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
        }
        return () => {
            if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
        };
    }, [isCameraOn, interviewMode]);


    // 🎙️ Safe Audio Recording Function (Isolates Audio Tracks to prevent NotSupportedError)
    const startAudioRecording = (stream) => {
        try {
            audioChunksRef.current = []; 

            
            if (audioTracks.length === 0) {
                console.error("[Vocal Log] No audio tracks found in stream.");
                return;
            }
            const audioOnlyStream = new MediaStream(audioTracks);

            
            let options = { mimeType: 'audio/webm;codecs=opus' };
            
            if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'audio/webm' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'audio/ogg;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'audio/mp4' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) options = {}; // Fallback to browser default

            console.log(`[Vocal Log] Selected MimeType: ${options.mimeType || 'Default'}`);

            
            const mediaRecorder = new MediaRecorder(audioOnlyStream, options);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            
            setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === "inactive") {
                    mediaRecorderRef.current.start(1000); // Record chunks every 1 second
                    console.log("[Vocal Log] Audio recording started safely in background...");
                }
            }, 500);

        } catch (err) {
            console.error("Failed to start Audio Recording:", err);
        }
    };

    // 🎥 Hardware Access (Webcam & Microphone)
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

            // Audio recording is now triggered explicitly by the user

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
        };
    }, [interviewMode]);

    const toggleCamera = async () => {
        if (isCameraOn) {
            if (streamRef.current) {
                const videoTrack = streamRef.current.getVideoTracks()[0];
                if (videoTrack) videoTrack.stop();
            }
            setIsCameraOn(false);
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

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            // Store what's already typed before recording
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

    const handleStopAndSend = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType || 'audio/webm' });
                await submitAudioAnswer(audioBlob);
            };
            mediaRecorderRef.current.stop();
            setIsRecording(false);
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

        try {
            const response = await axios.post("http://localhost:8000/api/chat-interview", formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                setChatHistory(prev => [...prev, { sender: "ai", text: response.data.nextQuestion, evaluation: response.data.evaluation }]);
            } else {
                setChatHistory(prev => [...prev, { sender: "ai", text: "Sorry, I couldn't process that response." }]);
            }
        } catch (error) {
            console.error("Failed to communicate with backend:", error);
            setChatHistory(prev => [...prev, { sender: "ai", text: "Connection error." }]);
        } finally {
            setIsWaitingForAi(false);
        }
    };

    const handleAnswerSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!userAnswer.trim() || isWaitingForAi) return;

        const currentAnswer = userAnswer;
        setUserAnswer(""); 

        const newUserMessage = { sender: "user", text: currentAnswer };
        setChatHistory(prev => [...prev, newUserMessage]);
        setIsWaitingForAi(true);

        try {
            const response = await axios.post("http://localhost:8000/api/chat-interview", {
                sessionId: sessionId,
                message: currentAnswer
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.data.success) {
                setChatHistory(prev => [...prev, { sender: "ai", text: response.data.nextQuestion, evaluation: response.data.evaluation }]);
            } else {
                setChatHistory(prev => [...prev, { sender: "ai", text: "Sorry, I couldn't process that response." }]);
            }
        } catch (error) {
            console.error("Failed to communicate with backend:", error);
            setChatHistory(prev => [...prev, { sender: "ai", text: "Connection error. Please check your backend server." }]);
        } finally {
            setIsWaitingForAi(false);
        }
    };

    const handleEndInterview = async () => {
        if (!window.confirm("Are you sure you want to end the interview?")) return;
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

            {/* TOP BAR */}
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
                        <span className="text-slate-400">GitHub:</span> <strong className="text-green-400">{github}</strong>
                    </div>
                    <button 
                        onClick={handleEndInterview} 
                        disabled={isEnding}
                        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isEnding ? <Loader2 className="animate-spin" size={14}/> : <StopCircle size={14}/>} End Interview
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                {/* LEFT SIDE: Chat Interface */}
                <div className="lg:col-span-8 bg-slate-900 rounded-[2rem] border border-slate-800 p-6 flex flex-col h-[70vh] shadow-2xl">
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
                        {chatHistory.map((msg, index) => (
                            <div key={index} className="flex flex-col mb-4">
                                <div className={`flex items-start gap-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                                    <div className={`p-2 rounded-xl border ${msg.sender === 'user' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-blue-400'}`}>
                                        {msg.sender === 'user' ? <User size={18} /> : <Bot size={18} />}
                                    </div>
                                    <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-md ${
                                        msg.sender === 'user' ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100 rounded-tr-none' : 'bg-slate-800/50 border border-slate-850 text-slate-200 rounded-tl-none'
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
                                                <div className={`w-2 h-2 rounded-full ${msg.evaluation.score >= 80 ? 'bg-green-400' : msg.evaluation.score >= 60 ? 'bg-orange-400' : 'bg-red-400'}`}></div>
                                                Instant Feedback (Score: {msg.evaluation.score})
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

                    <div className="mt-auto flex flex-col gap-2">
                        {interviewMode === "MULTIMODAL" && (
                            <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700 p-3 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <Mic size={20} className={isRecording ? "text-red-500 animate-pulse" : "text-slate-400"} />
                                    <span className="text-sm font-bold text-slate-300">
                                        {isRecording ? "Recording in progress..." : "Voice Answer"}
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
                                            <StopCircle size={14}/> Stop & Send Answer
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
                        {userAnswer.trim().length > 0 && userAnswer.trim().split(/\s+/).filter(w => w.length > 0).length < 4 && (
                            <p className="text-[10px] text-orange-400 font-bold px-2 mt-1">Please speak a detailed technical answer to enable submission.</p>
                        )}
                    </div>
                </div>

                {/* RIGHT SIDE: Live Camera Preview */}
                <div className="lg:col-span-4 space-y-6">
                    {interviewMode === "MULTIMODAL" ? (
                        <>
                            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-4 shadow-xl overflow-hidden relative aspect-video lg:aspect-square flex flex-col justify-center items-center">
                                {!cameraError ? (
                                    <div className="w-full h-full rounded-2xl bg-slate-950 border border-slate-850 relative overflow-hidden flex items-center justify-center">
                                        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover rounded-2xl scale-x-[-1] ${!isCameraOn ? 'hidden' : ''}`} />
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
                                            <div className="absolute bottom-4 left-4 right-4 bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 flex justify-between items-center z-10">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Live Emotion</span>
                                                    <span className="text-sm font-black text-blue-400">{visualMetrics.emotion || "Neutral"}</span>
                                                </div>
                                                <div className="flex flex-col text-right">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Confidence</span>
                                                    <span className={`text-sm font-black ${visualMetrics.score >= 70 ? 'text-green-400' : 'text-orange-400'}`}>
                                                        {visualMetrics.score !== null ? `${visualMetrics.score}%` : 'Evaluating...'}
                                                    </span>
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
                                Camera and microphone are disabled.<br/>Focus on providing detailed written responses.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InterviewSession;