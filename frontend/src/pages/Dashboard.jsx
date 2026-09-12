import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Rocket, Target, TrendingUp, History,
    ArrowRight, FileText, Activity, Code2,
    CheckCircle2, BrainCircuit, LineChart
} from 'lucide-react';

const Dashboard = () => {
    const navigate = useNavigate();

    // --- BSc Research Feature: replaced hardcoded/fake dashboard data
    // (name, confidence score, interview count, etc.) with real data
    // fetched from the backend, consistent with this project's
    // data-integrity policy applied throughout Steps 1-5.
    const [profile, setProfile] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const userId = localStorage.getItem("userId") || 1;

    useEffect(() => {
        Promise.all([
            axios.get(`http://localhost:8000/profile/${userId}`).catch(() => null),
            axios.get(`http://localhost:8000/api/interview-history/${userId}`).catch(() => null),
        ]).then(([profileRes, historyRes]) => {
            if (profileRes && profileRes.data) setProfile(profileRes.data);
            if (historyRes && historyRes.data && historyRes.data.success) {
                setHistory(historyRes.data.history || []);
            }
            setLoading(false);
        });
    }, [userId]);

    // NOTE: field names confirmed from actual /profile/{userId} response:
    // {"user_id":3,"full_name":"","email":"","university":"","degree":"",
    //  "role":"","github":"","linkedin":""}
    const displayName = profile?.full_name && profile.full_name.trim()
        ? profile.full_name
        : "Candidate";
    const academicStatus = profile?.degree && profile.degree.trim()
        ? profile.degree
        : (profile?.university && profile.university.trim() ? profile.university : "IT Undergraduate");

    const completedSessions = history.filter(s => s.status === "Completed");
    const latestSession = completedSessions.length > 0 ? completedSessions[0] : null; // history is already ordered desc by created_at

    const latestConfidenceScore = latestSession ? latestSession.overallScore : null;
    const latestTargetRole = latestSession ? latestSession.role : "Not set yet";
    const totalInterviews = history.length;
    const totalReports = completedSessions.length;

    const initials = displayName
        .split(" ")
        .map(w => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">

            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-8 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                        Hello, {loading ? "..." : displayName}! 👋
                    </h1>
                    <p className="text-slate-400 font-medium mt-1 uppercase text-[10px] tracking-widest">AI Interview System Dashboard</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <div className="text-right px-2">
                        <p className="font-bold text-slate-800 text-sm">{loading ? "..." : displayName}</p>
                        <p className="text-[10px] text-blue-600 font-black tracking-tighter uppercase">{academicStatus}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-200">
                        {loading ? ".." : initials}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Main Action Card with CSS Animation */}
                <div className="lg:col-span-2 relative overflow-hidden bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl shadow-blue-900/30">
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-10 h-full">

                        <div className="flex-1 text-center md:text-left">
                            <div className="bg-blue-500/20 w-fit px-4 py-1.5 rounded-full border border-blue-400/30 text-[10px] font-black uppercase tracking-widest mb-6 mx-auto md:mx-0 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                Multimodal Engine Active
                            </div>
                            <h2 className="text-4xl font-black mb-4 leading-tight">Master Your <br /> Interview Skills.</h2>
                            <p className="text-slate-400 font-medium mb-10 max-w-sm mx-auto md:mx-0">
                                Get real-time feedback on your confidence and behavior through our AI framework.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                                <button
                                    onClick={() => navigate('/InterviewSetup')}
                                    className="group bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-900/40"
                                >
                                    <Rocket size={22} className="group-hover:translate-x-1 transition-transform" />
                                    Start Interview Session
                                </button>
                                {/* BSc Research Feature (Step 5): Progress Tracker link */}
                                <button
                                    onClick={() => navigate('/progress')}
                                    className="group bg-white/10 hover:bg-white/20 border border-white/20 text-white px-8 py-5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3"
                                >
                                    <LineChart size={20} />
                                    View My Progress
                                </button>
                            </div>
                        </div>

                        {/* Cartoon-style CSS Animation Avatar - Friendly AI Interviewer */}
                        <div className="w-64 h-64 flex items-center justify-center relative group hidden md:flex">

                            {/* Floating Animation Wrapper */}
                            <div className="relative flex flex-col items-center justify-center animate-[bounce_3s_ease-in-out_infinite]">

                                {/* Antenna */}
                                <div className="relative flex flex-col items-center z-0 -mb-2">
                                    <div className="w-3 h-3 bg-cyan-400 rounded-full animate-ping absolute"></div>
                                    <div className="w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee] z-10"></div>
                                    <div className="w-1.5 h-6 bg-slate-600"></div>
                                </div>

                                {/* Head */}
                                <div className="relative w-36 h-28 bg-gradient-to-b from-slate-200 to-slate-300 rounded-[2rem] shadow-2xl border-b-4 border-slate-400 flex flex-col items-center justify-center z-10 overflow-hidden">

                                    {/* Screen / Visor */}
                                    <div className="w-28 h-14 bg-slate-900 rounded-2xl border-[3px] border-slate-800 flex items-center justify-center gap-4 shadow-inner relative overflow-hidden">
                                        {/* Glare effect */}
                                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/20 to-transparent opacity-50"></div>

                                        {/* Eyes */}
                                        <div className="w-4 h-5 bg-cyan-400 rounded-full animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_12px_#22d3ee]"></div>
                                        <div className="w-4 h-5 bg-cyan-400 rounded-full animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_12px_#22d3ee]"></div>
                                    </div>

                                    {/* Mouth / Speaker (Soundwaves style) */}
                                    <div className="flex gap-1 mt-3 items-end h-3">
                                        <div className="w-1.5 h-2 bg-slate-400 rounded-full animate-[pulse_1s_ease-in-out_infinite]"></div>
                                        <div className="w-1.5 h-3 bg-slate-400 rounded-full animate-[pulse_1.2s_ease-in-out_infinite_0.1s]"></div>
                                        <div className="w-1.5 h-2 bg-slate-400 rounded-full animate-[pulse_1.1s_ease-in-out_infinite_0.2s]"></div>
                                    </div>

                                </div>

                                {/* Neck */}
                                <div className="w-8 h-4 bg-slate-500 rounded-b-md z-0 shadow-inner"></div>

                                {/* Shoulders / Body base */}
                                <div className="w-44 h-12 bg-gradient-to-b from-blue-500 to-blue-700 rounded-t-[2.5rem] mt-[-2px] z-10 border-t-4 border-blue-400 shadow-xl flex justify-center pt-2">
                                    {/* Collar/Tie accent */}
                                    <div className="w-4 h-4 rotate-45 bg-cyan-300 rounded-sm shadow-[0_0_10px_#67e8f9]"></div>
                                </div>

                            </div>

                            {/* Background Tech Rings */}
                            <div className="absolute w-56 h-56 border border-blue-500/20 rounded-full animate-[spin_10s_linear_infinite] border-dashed"></div>
                            <div className="absolute w-44 h-44 border-2 border-cyan-500/10 rounded-full animate-[spin_8s_linear_infinite_reverse]"></div>

                            {/* Floating Particles */}
                            <div className="absolute top-4 right-12 w-2 h-2 bg-cyan-400 rounded-full animate-bounce shadow-[0_0_8px_#22d3ee]"></div>
                            <div className="absolute bottom-16 left-6 w-3 h-3 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]"></div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Stats */}
                <div className="bg-white rounded-[3.5rem] p-8 border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div className="space-y-8">
                        <div className="flex items-center gap-2">
                            <Activity className="text-blue-600" size={18} />
                            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Recent Activity</h4>
                        </div>

                        <div className="space-y-4">
                            <div className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100/50">
                                <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Latest Confidence Score</p>
                                <h3 className="text-3xl font-black text-slate-800 tracking-tighter">
                                    {loading ? "..." : (latestConfidenceScore !== null ? `${latestConfidenceScore}%` : "N/A")}
                                </h3>
                            </div>
                            <div className="p-5 bg-emerald-50/50 rounded-3xl border border-emerald-100/50">
                                <p className="text-[10px] font-black text-emerald-400 uppercase mb-1">Status</p>
                                <h3 className="text-xl font-black text-slate-800 italic">
                                    {loading ? "..." : (totalInterviews === 0 ? "Ready to Start" : "Ready to Prep")}
                                </h3>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/history')}
                        className="w-full bg-slate-900 text-white p-5 rounded-[2rem] font-bold flex items-center justify-between group hover:bg-blue-600 transition-all shadow-lg shadow-slate-200"
                    >
                        <span className="text-sm">Full History</span>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>

            {/* Bottom Mini Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                    { label: 'Interviews', val: loading ? "-" : String(totalInterviews).padStart(2, '0'), icon: History, color: 'text-blue-600' },
                    { label: 'Target', val: loading ? "-" : latestTargetRole, icon: Target, color: 'text-orange-600' },
                    { label: 'Reports', val: loading ? "-" : String(totalReports).padStart(2, '0'), icon: FileText, color: 'text-purple-600' },
                    { label: 'Status', val: academicStatus, icon: CheckCircle2, color: 'text-emerald-600' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all">
                        <div className={`${stat.color} p-3 bg-slate-50 rounded-2xl`}><stat.icon size={20} /></div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{stat.label}</p>
                            <h3 className="text-lg font-black text-slate-800 leading-tight">{stat.val}</h3>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
