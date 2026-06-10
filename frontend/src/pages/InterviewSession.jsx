import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
    Mic, MicOff, Video, VideoOff, 
    MessageSquare, ShieldCheck, Clock, ChevronRight, PhoneOff 
} from 'lucide-react';

const InterviewSession = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    
    const { role, difficulty, github, cvStatus } = location.state || { 
        role: "QA", difficulty: "Medium" 
    };

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [timeLeft, setTimeLeft] = useState(1800); // විනාඩි 30ක timer එකක්

    // Timer Logic
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto h-[90vh] flex flex-col">
                
                {/* Upper Bar */}
                <div className="flex justify-between items-center mb-6 bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                            Live Session
                        </div>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-tighter">
                            Role: <span className="text-white italic">{role}</span>
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-orange-400 font-mono font-bold">
                        <Clock size={16} /> {formatTime(timeLeft)}
                    </div>
                </div>

                {/* Main Grid: AI Humanoid & User Camera */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
                    
                    {/* Left: AI Interviewer Placeholder */}
                    <div className="lg:col-span-8 bg-slate-900 rounded-[3rem] border border-white/5 relative overflow-hidden flex items-center justify-center shadow-2xl shadow-blue-900/10">
                        <div className="text-center space-y-4">
                            <div className="w-32 h-32 bg-blue-600/10 rounded-full mx-auto flex items-center justify-center border border-blue-500/20 animate-pulse">
                                <ShieldCheck size={48} className="text-blue-500" />
                            </div>
                            <h3 className="text-slate-500 font-black uppercase tracking-[0.4em] text-xs">AI Interviewer</h3>
                            <p className="text-sm font-medium text-slate-400 italic">"Waiting for your response..."</p>
                        </div>
                    </div>

                    {/* Right: User Perspective & Transcript */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        {/* User Camera Preview */}
                        <div className="h-1/2 bg-slate-800 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                            {!isVideoOff ? (
                                <div className="absolute inset-0 bg-slate-700 animate-pulse flex items-center justify-center">
                                    <span className="text-[10px] font-black uppercase opacity-20 tracking-widest">Camera Stream</span>
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                                    <VideoOff size={32} className="text-slate-700" />
                                </div>
                            )}
                            <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                                You (Candidate)
                            </div>
                        </div>

                        {/* Speech Transcript Preview */}
                        <div className="h-1/2 bg-slate-900/50 rounded-[2.5rem] border border-white/5 p-6 space-y-4 overflow-y-auto">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5 pb-2">Real-time Transcript</h4>
                            <div className="space-y-4">
                                <p className="text-xs text-blue-400 font-medium leading-relaxed">AI: Could you explain how you've used Postman for API automation?</p>
                                <div className="flex gap-2">
                                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Controls */}
                <div className="mt-6 flex justify-center items-center gap-4">
                    <button 
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-5 rounded-2xl transition-all shadow-lg active:scale-95 ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-700 border border-white/5'}`}
                    >
                        {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>
                    
                    <button 
                        onClick={() => setIsVideoOff(!isVideoOff)}
                        className={`p-5 rounded-2xl transition-all shadow-lg active:scale-95 ${isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-700 border border-white/5'}`}
                    >
                        {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                    </button>

                    <button 
                        onClick={() => {
                            if(window.confirm("Are you sure you want to end the session?")) navigate('/dashboard');
                        }}
                        className="group bg-red-600 hover:bg-red-700 text-white px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-xl shadow-red-900/20 active:scale-95 flex items-center gap-2"
                    >
                        <PhoneOff size={18} /> End Interview
                    </button>
                </div>

            </div>
        </div>
    );
};

export default InterviewSession;