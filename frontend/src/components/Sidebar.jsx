import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();

   
    const isActive = (path) => location.pathname === path;

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
        { path: '/InterviewSetup', label: 'Start Interview', icon: '🚀' },
        { path: '/cv', label: 'CV Builder', icon: '✍️' },
        { path: '/history', label: 'My Interviews', icon: '🎥' },
        { path: '/profile', label: 'Profile', icon: '👤' },
    ];

    return (
        <div className="w-72 hidden md:flex flex-col sticky top-0 h-screen p-5 text-white border-r border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-slate-900/20">
            <div className="rounded-[2rem] p-5 bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-950/30">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-lg font-black">
                        M
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight">MockAI</h2>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-white/70">Interview companion</p>
                    </div>
                </div>
                <p className="text-sm text-white/80 mt-4 leading-relaxed">
                    Build confidence, practice interviews, and polish your career story in one place.
                </p>
            </div>

            <nav className="space-y-2 flex-1 mt-6">
                {navItems.map((item) => {
                    const active = isActive(item.path) || (item.path === '/dashboard' && isActive('/'));
                    return (
                        <div
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all duration-200 ${active ? 'bg-white text-slate-950 shadow-lg shadow-blue-950/20 font-bold' : 'text-slate-300 hover:bg-white/8 hover:text-white'}`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            <span className="text-sm">{item.label}</span>
                        </div>
                    );
                })}
            </nav>

            <div className="pt-5 border-t border-white/10 space-y-4">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Today</p>
                    <p className="mt-2 text-sm font-semibold text-white">Keep your momentum going.</p>
                </div>
                <button
                    onClick={() => {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        localStorage.removeItem('userId');
                        alert("Logging out...");
                        navigate('/');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-200 hover:bg-red-500/15 transition font-bold text-sm"
                >
                    <span className="text-lg">🚪</span>
                    <span>Logout</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;