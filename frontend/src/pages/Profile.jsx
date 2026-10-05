import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Mail, GraduationCap, Link2, Save, Loader2, CheckCircle2 } from 'lucide-react';

// --- BSc Research Feature: role options here MUST match the backend's
// AVAILABLE_ROLES exactly (see question_bank.py) - previously this
// dropdown offered role strings ("Fullstack Developer", "Data Science
// Intern") that don't exist in the app's actual 4 supported roles,
// meaning a saved profile role could never correctly match an
// Interview Setup selection. Fixed to the exact 4 supported roles.
const AVAILABLE_ROLES = ["Software Engineer", "QA Engineer", "Business Analyst", "UX/UI Designer"];

const Profile = () => {
    const [profile, setProfile] = useState({
        full_name: "",
        email: "",
        university: "",
        degree: "",
        role: "",
        github: "",
        linkedin: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const userId = localStorage.getItem("userId") || 1;

    useEffect(() => {
        axios.get(`http://localhost:8000/profile/${userId}`)
            .then(response => {
                setProfile(prev => ({ ...prev, ...response.data }));
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load profile:", err);
                setLoading(false);
            });
    }, [userId]);

    const handleChange = (field, value) => {
        setProfile(prev => ({ ...prev, [field]: value }));
        setSaveSuccess(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveSuccess(false);
        try {
            await axios.put(`http://localhost:8000/profile/${userId}`, profile);
            setSaveSuccess(true);
        } catch (err) {
            console.error("Failed to save profile:", err);
            alert("Could not save profile changes.");
        } finally {
            setSaving(false);
        }
    };

    // --- BSc Research Feature (Bug fix): avatar initials are now
    // generated dynamically from the user's actual full_name, instead
    // of a hardcoded "VU" placeholder that showed for every user
    // regardless of their real name.
    const getInitials = (name) => {
        if (!name || !name.trim()) return "?";
        return name.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    return (
        <div className="p-6 md:p-10 animate-in fade-in duration-500 max-w-3xl mx-auto space-y-8">

            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
                <User className="text-blue-500" size={32} />
                Profile
            </h1>

            {/* Avatar + Name Header */}
            <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm flex items-center gap-6">
                <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-blue-200 shrink-0">
                    {getInitials(profile.full_name)}
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{profile.full_name || "Unnamed User"}</h2>
                    <p className="text-sm text-slate-400 font-medium">{profile.email || "No email set"}</p>
                </div>
            </div>

            {/* Personal Details */}
            <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm space-y-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Personal Details</h3>

                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Full Name</label>
                    <input
                        type="text"
                        value={profile.full_name}
                        onChange={(e) => handleChange('full_name', e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
                    />
                </div>

                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block flex items-center gap-1.5">
                        <Mail size={12} /> Email
                    </label>
                    <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="you@example.com"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Academic Details */}
            <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm space-y-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                    <GraduationCap size={14} /> Academic Details
                </h3>

                {/* --- BSc Research Feature (Bug fix): university is now an
                    editable field showing the user's ACTUAL saved value,
                    instead of a hardcoded "KDU Sri Lanka" string shown for
                    every user regardless of their real university. The
                    previous fake "verified/synced" message (implying an
                    academic-records verification process that doesn't
                    exist) has also been removed. */}
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">University</label>
                    <input
                        type="text"
                        value={profile.university}
                        onChange={(e) => handleChange('university', e.target.value)}
                        placeholder="Enter your university"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
                    />
                </div>

                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Degree Programme</label>
                    <input
                        type="text"
                        value={profile.degree}
                        onChange={(e) => handleChange('degree', e.target.value)}
                        placeholder="e.g. BSc (Hons) Information Technology"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
                    />
                </div>

                {/* --- BSc Research Feature (Bug fix): options now exactly
                    match the backend's AVAILABLE_ROLES (question_bank.py),
                    so a saved profile role is guaranteed to correctly match
                    the roles offered in Interview Setup. */}
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Target Role</label>
                    <select
                        value={profile.role}
                        onChange={(e) => handleChange('role', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
                    >
                        <option value="">Select a role</option>
                        {AVAILABLE_ROLES.map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Links */}
            <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm space-y-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Professional Links</h3>

                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block flex items-center gap-1.5">
                        <Link2 size={12} /> GitHub Username
                    </label>
                    <input
                        type="text"
                        value={profile.github}
                        onChange={(e) => handleChange('github', e.target.value)}
                        placeholder="your-github-username"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
                    />
                </div>

                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block flex items-center gap-1.5">
                        <Link2 size={12} /> LinkedIn Profile URL
                    </label>
                    <input
                        type="text"
                        value={profile.linkedin}
                        onChange={(e) => handleChange('linkedin', e.target.value)}
                        placeholder="https://linkedin.com/in/your-profile"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    {saving ? "Saving..." : "Save Changes"}
                </button>
                {saveSuccess && (
                    <span className="flex items-center gap-1.5 text-green-600 text-sm font-bold">
                        <CheckCircle2 size={16} /> Saved!
                    </span>
                )}
            </div>
        </div>
    );
};

export default Profile;