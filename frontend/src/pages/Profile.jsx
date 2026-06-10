import React, { useState } from 'react';
import { 
  User, Mail, GraduateCap, Briefcase, 
  Github, Linkedin, Save, Camera, 
  CheckCircle2, ChevronRight 
} from 'lucide-react';

const Profile = () => {
    
    const [user, setUser] = useState({
        name: "Vishwani Umesha",
        email: "vishwani@example.com",
        university: "General Sir John Kotelawala Defence University",
        degree: "BSc (Hons) in Information Technology",
        role: "Software Quality Assurance (QA) Intern",
        github: "github.com/vishwani-u",
        linkedin: "linkedin.com/in/vishwani-umesha"
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        
        setTimeout(() => {
            setIsSaving(false);
            alert("Profile Updated Successfully! ✅");
        }, 1500);
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 max-w-4xl mx-auto space-y-8 pb-10">
            
            {/* Header Area */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-800">Profile Settings</h1>
                    <p className="text-slate-400 font-medium">Manage your academic and professional information</p>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
                >
                    {isSaving ? "Saving..." : <><Save size={18} /> Save Changes</>}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Left Side: Avatar & Quick Info */}
                <div className="space-y-6">
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                        
                        <div className="relative mt-4">
                            <div className="w-32 h-32 bg-slate-100 rounded-[2.5rem] mx-auto border-4 border-white shadow-xl flex items-center justify-center text-4xl font-black text-blue-600">
                                VU
                            </div>
                            <button className="absolute bottom-0 right-1/4 bg-white p-2 rounded-xl shadow-md border border-slate-100 text-slate-600 hover:text-blue-600">
                                <Camera size={16} />
                            </button>
                        </div>

                        <div className="mt-6">
                            <h3 className="text-xl font-black text-slate-800">{user.name}</h3>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">IT Undergraduate</p>
                        </div>
                    </div>

                    <div className="bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-100">
                        <div className="flex items-center gap-3 text-emerald-700 mb-2">
                            <CheckCircle2 size={18} />
                            <span className="font-black text-xs uppercase tracking-widest">Verification</span>
                        </div>
                        <p className="text-emerald-600/80 text-xs font-medium leading-relaxed">
                            Your academic records from KDU are synced and verified.
                        </p>
                    </div>
                </div>

                {/* Right Side: Editable Form */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                        
                        {/* Personal Info Section */}
                        <div className="space-y-6">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <User size={14} /> Personal Information
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 ml-1">Full Name</label>
                                    <input 
                                        type="text" 
                                        value={user.name}
                                        onChange={(e) => setUser({...user, name: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 ml-1">Email Address</label>
                                    <input 
                                        type="email" 
                                        value={user.email}
                                        className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-sm font-bold opacity-60 cursor-not-allowed"
                                        disabled
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Academic Info Section */}
                        <div className="space-y-6 pt-4 border-t border-slate-50">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Briefcase size={14} /> Academic & Career
                            </h4>
                            <div className="space-y-4">
                                <div className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div className="bg-white p-2 rounded-xl shadow-sm text-blue-600"><GraduateCap size={20}/></div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase">University</p>
                                        <p className="text-sm font-bold text-slate-800">KDU Sri Lanka</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 ml-1">Target Internship Role</label>
                                    <select 
                                        value={user.role}
                                        onChange={(e) => setUser({...user, role: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
                                    >
                                        <option>Software Quality Assurance (QA) Intern</option>
                                        <option>Software Engineering Intern</option>
                                        <option>Fullstack Developer</option>
                                        <option>Data Science Intern</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Social Connections */}
                        <div className="space-y-6 pt-4 border-t border-slate-50">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Github size={14} /> Social Profiles
                            </h4>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex items-center gap-3 bg-slate-900 text-white p-4 rounded-2xl border border-slate-800">
                                    <Github size={20} />
                                    <input 
                                        type="text" 
                                        value={user.github}
                                        onChange={(e) => setUser({...user, github: e.target.value})}
                                        className="bg-transparent border-none p-0 text-sm font-bold focus:ring-0 w-full"
                                    />
                                </div>
                                <div className="flex items-center gap-3 bg-[#0077B5] text-white p-4 rounded-2xl">
                                    <Linkedin size={20} />
                                    <input 
                                        type="text" 
                                        value={user.linkedin}
                                        className="bg-transparent border-none p-0 text-sm font-bold focus:ring-0 w-full"
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
};

export default Profile;