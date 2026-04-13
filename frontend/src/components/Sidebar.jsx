import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // දැනට ඉන්න page එක අනුව sidebar item එක highlight කරන්න
    const isActive = (path) => location.pathname === path;

    return (
        <div className="w-64 bg-[#0F172A] text-white p-6 hidden md:flex flex-col border-r border-slate-800 h-screen sticky top-0">
            <h2 className="text-2xl font-black mb-10 text-blue-500 italic tracking-tighter">MockAI</h2>
            
            <nav className="space-y-2 flex-1">
                <div 
                    onClick={() => navigate('/dashboard')} 
                    className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-all ${isActive('/dashboard') || isActive('/') ? 'bg-blue-600 shadow-lg font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                    <span className="text-lg">🏠</span>
                    <span>Dashboard</span>
                </div>

                <div 
                    onClick={() => navigate('/InterviewSetup')} 
                    className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-all ${isActive('/InterviewSetup') ? 'bg-blue-600 shadow-lg font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                    <span className="text-lg">🚀</span>
                    <span>Start Interview</span>
                </div>

                <div 
                    onClick={() => navigate('/cv')} 
                    className="flex items-center space-x-3 p-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl cursor-pointer transition text-sm font-medium"
                >
                    <span className="text-lg">✍️</span>
                    <span>CV Builder</span>
                </div>

                <div 
                    onClick={() => navigate('/history')} 
                    className="flex items-center space-x-3 p-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl cursor-pointer transition text-sm font-medium"
                >
                    <span className="text-lg">🎥</span>
                    <span>My Interviews</span>
                </div>

                <div className="flex items-center space-x-3 p-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl cursor-pointer transition text-sm font-medium">
                    <span className="text-lg">📊</span>
                    <span>Reports</span>
                </div>
            </nav>

            <div className="pt-6 border-t border-slate-800">
                <button 
                    onClick={() => { alert("Logging out..."); navigate('/'); }}
                    className="w-full flex items-center space-x-3 p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition font-bold text-sm"
                >
                    <span className="text-lg">🚪</span>
                    <span>Logout</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;