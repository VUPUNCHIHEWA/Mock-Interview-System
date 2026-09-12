import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    LayoutDashboard, Target, Loader2,
    Search, Code, ChevronRight, Palette, Briefcase,
    Info, Camera, Mic, CheckCircle2, XCircle, X
} from 'lucide-react';

const InterviewSetup = () => {
    const navigate = useNavigate();

    // States for functional logic
    // --- BUG FIX: previously only 'QA'/'Dev' were selectable here, but
    // the backend question_bank.py supports 4 curated roles (Software
    // Engineer, QA Engineer, UX/UI Designer, Business Analyst) - the
    // other 2 were completely inaccessible to students. Now all 4.
    const [selectedRole, setSelectedRole] = useState('QA');
    const [difficulty, setDifficulty] = useState('Medium');
    const [isLaunching, setIsLaunching] = useState(false);
    const [interviewMode, setInterviewMode] = useState('MULTIMODAL');

    // Camera/Mic pre-check state
    const [deviceCheck, setDeviceCheck] = useState({ status: 'idle', message: '' }); // idle | checking | success | error

    // --- BSc Research Feature: Camera/Mic Test Modal (live preview + audio
    // level meter), replacing the earlier "silent permission check" -
    // students requested being able to actually SEE themselves and see
    // their mic picking up sound, similar to Zoom/Google Meet's
    // "test your devices before joining" pattern.
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const testVideoRef = useRef(null);
    const testStreamRef = useRef(null);
    const audioCtxRef = useRef(null);
    const rafRef = useRef(null);

    // NOTE (BSc Research Feature): CV Upload and GitHub Sync were removed
    // from this page - question generation now uses the literature-curated
    // static question bank (role + difficulty based), which does not use
    // CV or GitHub data. CV Builder is still available separately at /cv,
    // and GitHub username is still saved on the Profile page.

    const ROLE_OPTIONS = [
        { key: 'QA', fullName: 'QA Engineer', label: 'Software QA', icon: Search, desc: 'Automation, API & Manual Testing' },
        { key: 'SE', fullName: 'Software Engineer', label: 'Software Engineer', icon: Code, desc: 'General Programming & Logic' },
        { key: 'UX', fullName: 'UX/UI Designer', label: 'UX/UI Designer', icon: Palette, desc: 'Usability, Wireframes & Design Systems' },
        { key: 'BA', fullName: 'Business Analyst', label: 'Business Analyst', icon: Briefcase, desc: 'Requirements, Stakeholders & Process Analysis' },
    ];

    const DIFFICULTY_DESCRIPTIONS = {
        Easy: 'Foundational, definition-level questions - good for a first practice run.',
        Medium: 'Applied questions requiring some real-world reasoning.',
        Hard: 'In-depth technical scenarios and edge-case reasoning.',
    };

    const selectedRoleData = ROLE_OPTIONS.find(r => r.key === selectedRole);

    // --- Camera/Mic Pre-Check Modal ---
    // Opens a modal showing a LIVE video preview and a real-time audio
    // level meter, so the student can actually confirm they're framed
    // correctly and their mic is picking up sound - not just a blind
    // "permission granted" message.
    const openDeviceTestModal = async () => {
        setIsTestModalOpen(true);
        setDeviceCheck({ status: 'checking', message: 'Requesting camera & microphone access...' });
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            testStreamRef.current = stream;
            if (testVideoRef.current) testVideoRef.current.srcObject = stream;

            // Live microphone level meter using the Web Audio API
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContextClass();
            audioCtxRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateLevel = () => {
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                setAudioLevel(Math.min(100, Math.round((avg / 100) * 100)));
                rafRef.current = requestAnimationFrame(updateLevel);
            };
            updateLevel();

            setDeviceCheck({ status: 'success', message: 'Camera and microphone are working correctly!' });
        } catch (err) {
            console.error("Device check failed:", err);
            setDeviceCheck({
                status: 'error',
                message: 'Could not access camera/microphone. Please check browser permissions, or switch to Text-Based Mode.'
            });
        }
    };

    const closeDeviceTestModal = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (audioCtxRef.current) audioCtxRef.current.close().catch(() => { });
        if (testStreamRef.current) testStreamRef.current.getTracks().forEach(track => track.stop());
        testStreamRef.current = null;
        setAudioLevel(0);
        setIsTestModalOpen(false);
    };

    // Ensure the camera/mic are released if the student navigates away
    // while the test modal happens to still be open.
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (audioCtxRef.current) audioCtxRef.current.close().catch(() => { });
            if (testStreamRef.current) testStreamRef.current.getTracks().forEach(track => track.stop());
        };
    }, []);

    const handleStartInterview = async () => {
        setIsLaunching(true);

        const fullRoleName = selectedRoleData.fullName;
        const userId = localStorage.getItem("userId") || 1;

        const payload = {
            role: fullRoleName,
            difficulty: difficulty,
            interviewMode: interviewMode,
            userId: parseInt(userId, 10)
        };

        try {
            const response = await axios.post("http://localhost:8000/api/start-interview", payload);
            if (response.data.success) {
                navigate('/interview-session', {
                    state: {
                        sessionId: response.data.sessionId,
                        firstQuestion: response.data.firstQuestion,
                        role: fullRoleName,
                        difficulty: difficulty,
                        interviewMode: interviewMode
                    }
                });
            }
        } catch (error) {
            console.error("Failed to start interview:", error);
            alert("Failed to initialize the interview session. Please try again.");
        } finally {
            setIsLaunching(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 animate-in fade-in duration-700">
            <div className="max-w-6xl mx-auto">

                {/* Header & Dashboard Link */}
                <div className="flex justify-between items-center mb-10">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="group flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-all font-bold text-[10px] uppercase tracking-[0.2em]"
                    >
                        <LayoutDashboard size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                    </button>
                    <div className="hidden md:flex gap-4">
                        <div className="bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm flex items-center gap-2">
                            <Target size={14} className="text-blue-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Target: {selectedRoleData.fullName}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT COLUMN: Configuration */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="mb-8">
                            <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Setup Session</h2>
                            <p className="text-slate-400 mt-3 font-medium text-sm">Configure your AI interviewer based on your target role.</p>
                        </div>

                        {/* NEW: Transparency Note - what gets analyzed */}
                        <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-5 flex gap-3 items-start">
                            <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-900/80 font-medium leading-relaxed">
                                <strong>What this session analyzes:</strong> In Multimodal mode, your camera is
                                used to measure eye contact &amp; head stability, and your microphone to measure
                                speech fluency (filler words, pauses, tone). No recordings leave this application.
                                This session has exactly 6 questions (3 general + 3 role/technical),
                                then click
                                "End Interview" whenever you're ready.
                            </p>
                        </div>

                        {/* STEP 1: DOMAIN & DIFFICULTY */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
                            <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                                <span className="bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-black">01</span>
                                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Interview Focus</h3>
                            </div>

                            {/* BUG FIX: all 4 backend-supported roles now shown, not just 2 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {ROLE_OPTIONS.map(role => {
                                    const Icon = role.icon;
                                    const isActive = selectedRole === role.key;
                                    return (
                                        <button
                                            key={role.key}
                                            onClick={() => setSelectedRole(role.key)}
                                            className={`group p-6 rounded-3xl border-2 transition-all text-left ${isActive ? 'border-blue-600 bg-blue-50/30 shadow-md' : 'border-slate-50 bg-slate-50/50 hover:border-slate-200 shadow-sm'}`}
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                <Icon size={20} />
                                            </div>
                                            <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest">{role.label}</h4>
                                            <p className="text-[10px] text-slate-400 mt-1 font-medium italic">{role.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>

                            <div>
                                <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl shadow-inner">
                                    {['Easy', 'Medium', 'Hard'].map(lvl => (
                                        <button
                                            key={lvl}
                                            onClick={() => setDifficulty(lvl)}
                                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${difficulty === lvl ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {lvl}
                                        </button>
                                    ))}
                                </div>
                                {/* NEW: difficulty description */}
                                <p className="text-[10px] text-slate-400 font-medium italic mt-3 px-1">
                                    {DIFFICULTY_DESCRIPTIONS[difficulty]}
                                </p>
                            </div>
                        </div>

                        {/* STEP 2: INTERVIEW MODE */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
                            <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                                <span className="bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-black">02</span>
                                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Interview Mode</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => setInterviewMode('TEXT')}
                                    className={`group p-6 rounded-3xl border-2 transition-all text-left ${interviewMode === 'TEXT' ? 'border-blue-600 bg-blue-50/30 shadow-md' : 'border-slate-50 bg-slate-50/50 hover:border-slate-200 shadow-sm'}`}
                                >
                                    <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest">📝 Text-Based Mode</h4>
                                    <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Text answers only, camera/mic disabled</p>
                                </button>
                                <button
                                    onClick={() => setInterviewMode('MULTIMODAL')}
                                    className={`group p-6 rounded-3xl border-2 transition-all text-left ${interviewMode === 'MULTIMODAL' ? 'border-blue-600 bg-blue-50/30 shadow-md' : 'border-slate-50 bg-slate-50/50 hover:border-slate-200 shadow-sm'}`}
                                >
                                    <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest">🎙️🎥 Multimodal Live Mode</h4>
                                    <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Live video stream and voice recording</p>
                                </button>
                            </div>

                            {/* NEW: Camera/Mic Pre-Check */}
                            {interviewMode === 'MULTIMODAL' && (
                                <div className="border-t border-slate-50 pt-6">
                                    <button
                                        type="button"
                                        onClick={openDeviceTestModal}
                                        disabled={deviceCheck.status === 'checking'}
                                        className="w-full flex items-center justify-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-60"
                                    >
                                        {deviceCheck.status === 'checking' ? (
                                            <><Loader2 size={16} className="animate-spin" /> Checking Devices...</>
                                        ) : (
                                            <><Camera size={16} /><Mic size={16} /> Test Camera &amp; Microphone</>
                                        )}
                                    </button>
                                    {deviceCheck.status === 'success' && !isTestModalOpen && (
                                        <div className="mt-3 flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                                            <CheckCircle2 size={16} /> {deviceCheck.message}
                                        </div>
                                    )}
                                    {deviceCheck.status === 'error' && (
                                        <div className="mt-3 flex items-center gap-2 text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-xl p-3">
                                            <XCircle size={16} /> {deviceCheck.message}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Final Review & Launch */}
                    <div className="lg:col-span-4">
                        <div className="bg-blue-600 p-10 rounded-[3rem] text-white shadow-2xl shadow-blue-200 sticky top-10 overflow-hidden group">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>

                            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60 mb-10">Live Preview</h4>

                            <div className="space-y-8 mb-12">
                                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                    <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Job Role</span>
                                    <span className="text-lg font-black italic tracking-tighter uppercase text-right">
                                        {selectedRoleData.fullName}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                    <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Difficulty</span>
                                    <span className="text-xl font-black italic tracking-tighter uppercase">{difficulty}</span>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                    <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Mode</span>
                                    <span className="text-xl font-black italic tracking-tighter uppercase">
                                        {interviewMode === 'TEXT' ? 'Text' : 'Multimodal'}
                                    </span>
                                </div>
                                {/* NEW: honest, flexible-length note instead of a fixed count */}
                                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                    <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Length</span>
                                    <span className="text-sm font-black italic tracking-tighter uppercase text-right">6 Questions (Fixed)</span>
                                </div>
                            </div>

                            <p className="text-[9px] text-center mt-6 font-bold uppercase tracking-widest opacity-40 leading-relaxed">
                                Live Preview of your selected configuration.
                            </p>
                        </div>
                    </div>

                </div>

                {/* BOTTOM: Launch Button */}
                <div className="mt-12 flex flex-col items-center">
                    <button
                        onClick={handleStartInterview}
                        disabled={isLaunching}
                        className="group w-full max-w-md bg-blue-600 text-white py-6 rounded-[2rem] font-black text-lg uppercase tracking-tighter hover:bg-slate-900 transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95 disabled:bg-slate-300 disabled:text-slate-500"
                    >
                        {isLaunching ? (
                            <>Initializing... <Loader2 className="animate-spin" size={20} /></>
                        ) : (
                            <>Launch AI Interview <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" /></>
                        )}
                    </button>

                    <p className="text-[9px] text-center mt-6 font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                        AI will analyze your Multimodal patterns <br /> during this session.
                    </p>
                </div>

                {/* --- Camera/Mic Test Modal (live preview + audio level meter) --- */}
                {isTestModalOpen && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative">
                            <button
                                onClick={closeDeviceTestModal}
                                className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1">Device Test</h3>
                            <p className="text-xs text-slate-400 font-medium mb-6">Confirm you're framed correctly and your mic is picking up sound.</p>

                            {/* Live video preview */}
                            <div className="w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden mb-4 flex items-center justify-center">
                                {deviceCheck.status === 'checking' && (
                                    <Loader2 className="animate-spin text-white" size={28} />
                                )}
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

                            {/* Live audio level meter */}
                            {deviceCheck.status === 'success' && (
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                            <Mic size={14} /> Microphone Level
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">Speak to test</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-400 transition-all duration-100 rounded-full"
                                            style={{ width: `${audioLevel}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                {deviceCheck.status === 'success' && (
                                    <button
                                        onClick={closeDeviceTestModal}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                                    >
                                        Looks Good ✓
                                    </button>
                                )}
                                {deviceCheck.status === 'error' && (
                                    <button
                                        onClick={openDeviceTestModal}
                                        className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                                    >
                                        Try Again
                                    </button>
                                )}
                                <button
                                    onClick={closeDeviceTestModal}
                                    className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InterviewSetup;