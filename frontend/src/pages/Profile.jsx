import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { notifyProfileUpdated } from '../utils/currentUser';
import { Save, Loader2 } from 'lucide-react';
import { PageHeader, Card, Alert, PageLoader, Field, btn, inputClass } from '../components/ui';

const API = "http://localhost:8000";

// ---------------------------------------------------------------------------
// Profile (UI redesign, Oct 2026).
// Same data and save call as before. The "Target role" field is no longer
// shown: interviews have no job role any more (ASSUMPTIONS D1, I24). Any role
// already saved is kept unchanged because the whole profile object is sent
// back on save.
// ---------------------------------------------------------------------------

const getInitials = (name) => {
    if (!name || !name.trim()) return "?";
    return name.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
};

// One settings section: title + description on the left, fields on the right
const Section = ({ title, description, children }) => (
    <div className="grid gap-4 px-5 py-6 sm:px-6 md:grid-cols-3 md:gap-8">
        <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        <div className="space-y-4 md:col-span-2">{children}</div>
    </div>
);

const Profile = () => {
    const navigate = useNavigate();
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
    const [error, setError] = useState('');
    const [dirty, setDirty] = useState(false);

    const userId = localStorage.getItem("userId");

    useEffect(() => {
        if (!userId) {
            navigate('/login', { replace: true });
            return;
        }
        axios.get(`${API}/profile/${userId}`)
            .then(response => setProfile(prev => ({ ...prev, ...response.data })))
            .catch(err => {
                console.error("Failed to load profile:", err);
                setError("Could not load your profile. Please check that the backend is running.");
            })
            .finally(() => setLoading(false));
    }, [userId, navigate]);

    const handleChange = (field, value) => {
        setProfile(prev => ({ ...prev, [field]: value }));
        setSaveSuccess(false);
        setDirty(true);
    };

    const handleSave = async (e) => {
        e?.preventDefault();
        setSaving(true);
        setSaveSuccess(false);
        setError('');
        try {
            await axios.put(`${API}/profile/${userId}`, profile);
            setSaveSuccess(true);
            setDirty(false);
            // Update the name shown in the sidebar and dashboard (I20)
            notifyProfileUpdated();
        } catch (err) {
            console.error("Failed to save profile:", err);
            setError("Could not save your changes. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <PageLoader />;

    const field = (key) => ({
        id: `profile-${key}`,
        value: profile[key] || "",
        onChange: (e) => handleChange(key, e.target.value),
        className: inputClass,
    });

    return (
        <form onSubmit={handleSave} noValidate>
            <PageHeader
                title="Profile"
                description="Your personal and academic details."
                actions={
                    <button type="submit" disabled={saving || !dirty} className={btn.primary}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? "Saving..." : "Save changes"}
                    </button>
                }
            />

            {error && <Alert tone="error" className="mt-5" onClose={() => setError('')}>{error}</Alert>}
            {saveSuccess && <Alert tone="success" className="mt-5" onClose={() => setSaveSuccess(false)}>Your profile was saved.</Alert>}

            {/* Summary */}
            <Card className="mt-6 flex items-center gap-4 p-5 sm:p-6">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-blue-100 text-lg font-semibold text-blue-700">
                    {getInitials(profile.full_name)}
                </span>
                <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">{profile.full_name || "Add your name"}</p>
                    <p className="truncate text-sm text-slate-500">{profile.email || "No email added"}</p>
                    {(profile.degree || profile.university) && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">{[profile.degree, profile.university].filter(Boolean).join(' · ')}</p>
                    )}
                </div>
            </Card>

            <Card className="mt-5 divide-y divide-slate-100">
                <Section title="Personal details" description="Your name is shown in the sidebar and on the dashboard.">
                    <Field id="profile-full_name" label="Full name">
                        <input type="text" placeholder="Enter your full name" autoComplete="name" {...field('full_name')} />
                    </Field>
                    <Field id="profile-email" label="Contact email" hint="Shown on your profile. Your log in email does not change.">
                        <input type="email" placeholder="you@example.com" autoComplete="email" {...field('email')} />
                    </Field>
                </Section>

                <Section title="Academic details" description="Your university and degree programme.">
                    <Field id="profile-university" label="University">
                        <input type="text" placeholder="Enter your university" {...field('university')} />
                    </Field>
                    <Field id="profile-degree" label="Degree programme">
                        <input type="text" placeholder="e.g. BSc (Hons) Information Technology" {...field('degree')} />
                    </Field>
                </Section>

                <Section title="Professional links" description="Links to your GitHub and LinkedIn profiles.">
                    <Field id="profile-github" label="GitHub username">
                        <input type="text" placeholder="your-github-username" {...field('github')} />
                    </Field>
                    <Field id="profile-linkedin" label="LinkedIn profile URL">
                        <input type="url" placeholder="https://linkedin.com/in/your-profile" {...field('linkedin')} />
                    </Field>
                </Section>
            </Card>

            <div className="mt-5 flex justify-end">
                <button type="submit" disabled={saving || !dirty} className={btn.primary}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? "Saving..." : "Save changes"}
                </button>
            </div>
        </form>
    );
};

export default Profile;