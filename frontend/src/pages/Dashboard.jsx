import React from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const navigate = useNavigate();

    return (
        <div className="animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">Candidate Dashboard</h1>
                    <p className="text-slate-400 text-sm font-medium">Final Year Project - AI Mock Interview System</p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="text-right">
                        <p className="font-bold text-slate-800 leading-none">Vishwani Umesha</p>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold mt-1 inline-block uppercase">IT Undergraduate</span>
                    </div>
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold">VU</div>
                </div>
            </header>

            {/* Quick Stats Grid - මේ ටික තමයි ඔයාගේ image එකේ තියෙන්නේ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Interviews</p>
                    <h3 className="text-4xl font-black text-slate-800">04</h3>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Avg. Confidence</p>
                    <h3 className="text-4xl font-black text-emerald-500">78%</h3>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Target Role</p>
                    <h3 className="text-2xl font-bold text-blue-600 italic">QA Engineer</h3>
                </div>
            </div>

            {/* Start Button Area */}
            <div className="bg-white p-20 rounded-[3.5rem] text-center border-2 border-dashed border-slate-200">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🚀</div>
                <h2 className="text-3xl font-black text-slate-800 mb-4">Ready to Start?</h2>
                <p className="text-slate-500 mb-10 max-w-md mx-auto font-medium leading-relaxed">
                    Set up your interview by syncing your GitHub and CV for a personalized experience.
                </p>
                <button 
                    onClick={() => navigate('/InterviewSetup')}
                    className="bg-blue-600 text-white px-16 py-5 rounded-[2rem] font-black text-xl hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 active:scale-95"
                >
                    Launch Interview Setup
                </button>
            </div>
        </div>
    );
};

export default Dashboard;