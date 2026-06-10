import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Rocket, Target, TrendingUp, History, 
  ArrowRight, FileText, Activity, Code2, 
  CheckCircle2, BrainCircuit 
} from 'lucide-react';

const Dashboard = () => {
    const navigate = useNavigate();

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
            
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-8 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Hello, Vishwani! 👋</h1>
                    <p className="text-slate-400 font-medium mt-1 uppercase text-[10px] tracking-widest">AI Interview System Dashboard</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <div className="text-right px-2">
                        <p className="font-bold text-slate-800 text-sm">Vishwani Umesha</p>
                        <p className="text-[10px] text-blue-600 font-black tracking-tighter uppercase">IT Undergraduate • KDU</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-200">VU</div>
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
                            <button 
                                onClick={() => navigate('/InterviewSetup')}
                                className="group bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-900/40"
                            >
                                <Rocket size={22} className="group-hover:translate-x-1 transition-transform" />
                                Start Interview Session
                            </button>
                        </div>

                        {/* Cartoon-style CSS Animation Avatar */}
                        <div className="w-64 h-64 flex items-center justify-center relative">
                            {/* Outer Glow Circles */}
                            <div className="absolute w-full h-full bg-blue-500/10 rounded-full animate-ping [animation-duration:3s]"></div>
                            <div className="absolute w-48 h-48 bg-indigo-500/20 rounded-full animate-pulse"></div>
                            
                            {/* The AI Character (CSS Drawing) */}
                            <div className="relative w-40 h-40 bg-gradient-to-tr from-blue-700 to-cyan-400 rounded-3xl rotate-12 flex items-center justify-center shadow-2xl border border-white/20 animate-bounce [animation-duration:4s]">
                                <div className="absolute -inset-1 bg-gradient-to-tr from-blue-400 to-cyan-300 rounded-3xl blur opacity-30"></div>
                                {/* Character Eyes */}
                                <div className="flex gap-4 -rotate-12">
                                    <div className="w-4 h-6 bg-white rounded-full animate-pulse"></div>
                                    <div className="w-4 h-6 bg-white rounded-full animate-pulse"></div>
                                </div>
                                {/* Character Mouth */}
                                <div className="absolute bottom-8 w-10 h-1.5 bg-white/40 rounded-full -rotate-12"></div>
                            </div>
                            
                            {/* Floating Particles */}
                            <div className="absolute top-0 right-10 w-3 h-3 bg-blue-400 rounded-full animate-bounce [animation-delay:1s]"></div>
                            <div className="absolute bottom-10 left-5 w-2 h-2 bg-indigo-400 rounded-full animate-ping"></div>
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
                                <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Confidence Score</p>
                                <h3 className="text-3xl font-black text-slate-800 tracking-tighter">78%</h3>
                            </div>
                            <div className="p-5 bg-emerald-50/50 rounded-3xl border border-emerald-100/50">
                                <p className="text-[10px] font-black text-emerald-400 uppercase mb-1">Status</p>
                                <h3 className="text-xl font-black text-slate-800 italic">Ready to Prep</h3>
                            </div>
                        </div>
                    </div>

                    <button className="w-full bg-slate-900 text-white p-5 rounded-[2rem] font-bold flex items-center justify-between group hover:bg-blue-600 transition-all shadow-lg shadow-slate-200">
                        <span className="text-sm">Full History</span>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>

            {/* Bottom Mini Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                    { label: 'Interviews', val: '04', icon: History, color: 'text-blue-600' },
                    { label: 'Target', val: 'QA Eng', icon: Target, color: 'text-orange-600' },
                    { label: 'Reports', val: '03', icon: FileText, color: 'text-purple-600' },
                    { label: 'Status', val: 'Final Year', icon: CheckCircle2, color: 'text-emerald-600' }
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