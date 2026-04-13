import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckCircle, Target } from 'lucide-react'; 
import CVUpload from '../components/CVUpload';

const InterviewSetup = () => {
    const navigate = useNavigate();

    return (
        <div className="max-w-5xl mx-auto p-6 animate-in slide-in-from-bottom-8 duration-500">
            {/* Header with Stats */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Interview Center</h2>
                    <p className="text-slate-400 font-medium text-sm">Prepare and sync your data for the AI analysis.</p>
                </div>
                
                {/* Mini Stats for Dashboard feel */}
                <div className="hidden md:flex gap-4">
                    <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <CheckCircle size={16} className="text-green-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Past: 12</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <Target size={16} className="text-blue-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg: 85%</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side: Setup Form */}
                <div className="lg:col-span-8 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10">
                    <div className="space-y-8">
                        {/* GitHub Sync */}
                        <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                            <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-700">
                                <span className="bg-white p-2 rounded-lg shadow-sm">🔗</span> GitHub Project Sync
                            </h3>
                            <div className="flex space-x-2">
                                <input type="text" placeholder="GitHub Username" className="flex-1 p-4 bg-white rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold" />
                                <button className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-blue-600 transition shadow-lg text-xs uppercase">Sync</button>
                            </div>
                        </div>

                        {/* CV Upload */}
                        <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                            <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-700">
                                <span className="bg-white p-2 rounded-lg shadow-sm">📄</span> CV & Resume Analysis
                            </h3>
                            <CVUpload />
                        </div>

                        <button 
                            onClick={() => navigate('/interview-session')} 
                            className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-xl hover:bg-slate-900 transition shadow-2xl shadow-blue-100 uppercase tracking-tighter"
                        >
                            🎥 Start AI Mock Interview
                        </button>
                    </div>
                </div>

                
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl">
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Quick Tips</h4>
                        <ul className="space-y-4 text-xs font-medium text-slate-300">
                            <li className="flex gap-3"><span>•</span> Ensure your camera is at eye level.</li>
                            <li className="flex gap-3"><span>•</span> Use a quiet environment for better audio.</li>
                            <li className="flex gap-3"><span>•</span> AI will analyze both your speech and confidence.</li>
                        </ul>
                    </div>
                    
                    <button onClick={() => navigate('/dashboard')} className="w-full py-4 text-slate-400 hover:text-slate-800 font-bold text-[10px] uppercase tracking-widest flex justify-center items-center gap-2">
                        <LayoutDashboard size={14} /> Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InterviewSetup;