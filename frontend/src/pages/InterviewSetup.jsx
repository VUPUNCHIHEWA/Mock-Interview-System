import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, CheckCircle, Target, Loader2, 
    Search, Code, FilePlus, AlertCircle, ChevronRight
} from 'lucide-react'; 
import CVUpload from '../components/CVUpload';

const InterviewSetup = () => {
    const navigate = useNavigate();
    
    // States for functional logic
    const [selectedRole, setSelectedRole] = useState('QA'); 
    const [difficulty, setDifficulty] = useState('Medium');
    const [githubUser, setGithubUser] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasCV, setHasCV] = useState(false); 

    // GitHub Sync Logic
    const handleGithubSync = () => {
        if (!githubUser) return alert("Please enter your GitHub username!");
        setIsSyncing(true);
        setTimeout(() => {
            setIsSyncing(false);
            alert(`GitHub profile for ${githubUser} synced successfully!`);
        }, 2000);
    };

    // Final Action: Pass all data to the Interview Session
    const handleStartInterview = () => {
        navigate('/interview-session', { 
            state: { 
                role: selectedRole,
                difficulty: difficulty,
                github: githubUser,
                cvStatus: hasCV
            } 
        });
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
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target: {selectedRole}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT COLUMN: Configuration */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="mb-8">
                            <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Setup Session</h2>
                            <p className="text-slate-400 mt-3 font-medium text-sm">Configure your AI interviewer based on your profile and target role.</p>
                        </div>

                        {/* STEP 1: DATA SOURCES (CV FIRST) */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
                            <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                                <span className="bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-black">01</span>
                                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Knowledge Sources</h3>
                            </div>

                            {/* CV Section: Upload or Build */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Professional Profile (CV)</label>
                                
                                <div className="p-8 rounded-[2rem] border-2 border-dashed border-slate-100 bg-slate-50/50">
                                    {!hasCV ? (
                                        <div className="space-y-6 text-center">
                                            {/* Option 1: Upload Component */}
                                            <div className="flex flex-col items-center">
                                                <CVUpload onUploadSuccess={() => setHasCV(true)} />
                                            </div>

                                            {/* Divider */}
                                            <div className="flex items-center gap-4 py-2">
                                                <div className="h-[1px] bg-slate-200 flex-1"></div>
                                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">OR</span>
                                                <div className="h-[1px] bg-slate-200 flex-1"></div>
                                            </div>

                                            {/* Option 2: Navigate to Builder */}
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <AlertCircle size={14} className="text-orange-400" />
                                                    <p className="text-[11px] font-medium italic">No prepared CV? Build one instantly.</p>
                                                </div>
                                                <button 
                                                    onClick={() => navigate('/cv')} 
                                                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-900 px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-sm hover:border-blue-500 hover:text-blue-600 transition-all active:scale-95"
                                                >
                                                    <FilePlus size={16} /> Use AI CV Builder
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center py-4">
                                            <div className="bg-green-50 text-green-600 p-4 rounded-2xl flex items-center gap-3 mb-4 w-full">
                                                <CheckCircle size={20} />
                                                <span className="text-xs font-black uppercase tracking-widest">CV Profile Loaded Successfully</span>
                                            </div>
                                            <button 
                                                onClick={() => setHasCV(false)} 
                                                className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-orange-500 transition-colors"
                                            >
                                                Change CV or use builder
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* GitHub Sync */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Connect GitHub</label>
                                <div className="flex gap-3">
                                    <input 
                                        value={githubUser} 
                                        onChange={(e)=>setGithubUser(e.target.value)} 
                                        type="text" 
                                        placeholder="GitHub Username" 
                                        className="flex-1 p-5 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm transition-all shadow-inner" 
                                    />
                                    <button 
                                        onClick={handleGithubSync} 
                                        className="bg-slate-900 text-white px-8 rounded-2xl font-black text-[10px] uppercase hover:bg-blue-600 transition-all shadow-lg active:scale-95"
                                    >
                                        {isSyncing ? <Loader2 className="animate-spin" /> : "Sync"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* STEP 2: DOMAIN & DIFFICULTY (ROLE SECOND) */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
                            <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                                <span className="bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-black">02</span>
                                <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Interview Focus</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setSelectedRole('QA')} 
                                    className={`group p-6 rounded-3xl border-2 transition-all text-left ${selectedRole === 'QA' ? 'border-blue-600 bg-blue-50/30 shadow-md' : 'border-slate-50 bg-slate-50/50 hover:border-slate-200 shadow-sm'}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all ${selectedRole === 'QA' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                        <Search size={20} />
                                    </div>
                                    <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest">Software QA</h4>
                                    <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Automation, API & Manual Testing</p>
                                </button>

                                <button 
                                    onClick={() => setSelectedRole('Dev')} 
                                    className={`group p-6 rounded-3xl border-2 transition-all text-left ${selectedRole === 'Dev' ? 'border-blue-600 bg-blue-50/30 shadow-md' : 'border-slate-50 bg-slate-50/50 hover:border-slate-200 shadow-sm'}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all ${selectedRole === 'Dev' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                        <Code size={20} />
                                    </div>
                                    <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest">Full-Stack Dev</h4>
                                    <p className="text-[10px] text-slate-400 mt-1 font-medium italic">React, Spring Boot & Logic</p>
                                </button>
                            </div>

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
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Final Review & Launch */}
                    <div className="lg:col-span-4">
                        <div className="bg-blue-600 p-10 rounded-[3rem] text-white shadow-2xl shadow-blue-200 sticky top-10 overflow-hidden group">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
                            
                            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60 mb-10">Live Preview</h4>
                            
                            <div className="space-y-8 mb-12">
                                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                    <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">CV Data</span>
                                    <span className={`text-[11px] font-black uppercase tracking-widest ${hasCV ? 'text-green-300' : 'text-white/40'}`}>
                                        {hasCV ? 'Ready' : 'Pending'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                    <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Job Role</span>
                                    <span className="text-xl font-black italic tracking-tighter uppercase">{selectedRole === 'QA' ? 'QA Engineer' : 'Full-Stack'}</span>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                    <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Difficulty</span>
                                    <span className="text-xl font-black italic tracking-tighter uppercase">{difficulty}</span>
                                </div>
                            </div>

                            <button 
                                onClick={handleStartInterview}
                                className="group w-full bg-white text-blue-600 py-6 rounded-[2rem] font-black text-lg uppercase tracking-tighter hover:bg-slate-900 hover:text-white transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Launch AI Interview <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            
                            <p className="text-[9px] text-center mt-6 font-bold uppercase tracking-widest opacity-40 leading-relaxed">
                                AI will analyze your Multimodal patterns <br/> and professional background.
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default InterviewSetup;