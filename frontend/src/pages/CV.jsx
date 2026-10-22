import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Save, Download, Loader2, RefreshCw, Check, FolderGit2 } from 'lucide-react';
import { PageHeader, Card, Alert, Field, btn, inputClass } from '../components/Ui';

// Template 1: Modern Layout (Your Original Styling)
const ModernTemplate = ({ cvData, selectedProjects }) => (
    <div className="w-full text-left bg-white">
        <div className="p-10 bg-slate-900 text-white relative">
            <h2 className="text-3xl font-black tracking-tighter uppercase leading-tight">
                {cvData.fullName || "YOUR FULL NAME"}
            </h2>
            <p className="text-blue-400 font-black uppercase tracking-[0.3em] text-[9px] mt-2 italic">
                {cvData.role}
            </p>
            <div className="flex gap-6 mt-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-800 pt-4">
                <span>📧 {cvData.email || "email@example.com"}</span>
                <span>📞 {cvData.phone || "+94 7x xxx xxxx"}</span>
            </div>
        </div>

        <div className="p-10 space-y-8 bg-white">
            <div className="grid grid-cols-12 gap-8">
                <div className="col-span-7">
                    <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                        <span className="w-4 h-[1.5px] bg-blue-600"></span> Profile
                    </h4>
                    <p className="text-slate-600 text-[11px] leading-relaxed whitespace-pre-line">
                        {cvData.summary || "Add a summary about your skills and goals..."}
                    </p>
                </div>
                <div className="col-span-5">
                    <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-[0.3em] mb-3">Education</h4>
                    <p className="text-slate-800 text-[10px] font-bold uppercase leading-tight">
                        {cvData.education || "University and degree details"}
                    </p>
                </div>
            </div>

            <section className="pt-6 border-t border-slate-50">
                <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-[0.3em] mb-4">Technical Stack</h4>
                <div className="flex flex-wrap gap-1.5">
                    {cvData.skills ? cvData.skills.split(',').map((s, i) => (
                        <span key={i} className="bg-slate-50 text-slate-700 px-2 py-1 rounded text-[8px] font-black border border-slate-100 uppercase">
                            {s.trim()}
                        </span>
                    )) : <span className="text-slate-200 text-[9px]">Add skills...</span>}
                </div>
            </section>

            <section className="pt-6 border-t border-slate-50">
                <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-[0.3em] mb-6">Key Projects</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedProjects.length > 0 ? selectedProjects.map((p, i) => (
                        <div key={i} className="border-l-2 border-slate-100 pl-4">
                            <h5 className="text-[10px] font-black text-slate-800 uppercase">{p.name}</h5>
                            <p className="text-[9px] text-slate-500 mt-1 leading-normal italic">{p.desc}</p>
                            <span className="inline-block mt-2 text-[7px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase">
                                {p.tech}
                            </span>
                        </div>
                    )) : <p className="text-slate-300 text-[9px] italic">Select projects from GitHub...</p>}
                </div>
            </section>

            {(cvData.certifications || cvData.publications) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-50">
                    {cvData.certifications && (
                        <div>
                            <h4 className="text-[9px] font-black text-blue-600 uppercase mb-2">Certifications</h4>
                            <p className="text-slate-600 text-[9px] font-bold italic leading-snug">{cvData.certifications}</p>
                        </div>
                    )}
                    {cvData.publications && (
                        <div>
                            <h4 className="text-[9px] font-black text-blue-600 uppercase mb-2">Publications</h4>
                            <p className="text-slate-600 text-[9px] font-medium italic leading-snug">{cvData.publications}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
);

// Template 2: Minimalist Layout (Clean, Single Column, Classic)
const MinimalTemplate = ({ cvData, selectedProjects }) => (
    <div className="w-full text-left bg-white p-12 space-y-8">
        <div className="border-b-2 border-slate-800 pb-6 text-center">
            <h2 className="text-3xl font-serif tracking-wide text-slate-900 uppercase">
                {cvData.fullName || "YOUR FULL NAME"}
            </h2>
            <p className="text-slate-500 font-medium uppercase tracking-[0.2em] text-[10px] mt-1">
                {cvData.role}
            </p>
            <div className="flex justify-center gap-4 mt-3 text-[9px] text-slate-500 font-semibold">
                <span>📧 {cvData.email || "email@example.com"}</span>
                <span>•</span>
                <span>📞 {cvData.phone || "+94 7x xxx xxxx"}</span>
            </div>
        </div>

        <div className="space-y-6">
            <div>
                <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 mb-2">Professional Summary</h4>
                <p className="text-slate-600 text-[11px] leading-relaxed">{cvData.summary || "Add summary..."}</p>
            </div>

            <div>
                <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 mb-2">Education</h4>
                <p className="text-slate-700 text-[10px] font-bold uppercase">{cvData.education || "Add education..."}</p>
            </div>

            <div>
                <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 mb-2">Core Skills</h4>
                <p className="text-slate-600 text-[10px] tracking-wide leading-relaxed uppercase">{cvData.skills || "Add skills..."}</p>
            </div>

            <div>
                <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 mb-4">Featured Projects</h4>
                <div className="space-y-4">
                    {selectedProjects.map((p, i) => (
                        <div key={i}>
                            <div className="flex justify-between items-baseline">
                                <h5 className="text-[10px] font-bold text-slate-800 uppercase">{p.name}</h5>
                                <span className="text-[8px] font-mono text-slate-400">{p.tech}</span>
                            </div>
                            <p className="text-[9px] text-slate-500 mt-0.5 italic">{p.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {(cvData.certifications || cvData.publications) && (
                <div className="grid grid-cols-2 gap-6">
                    {cvData.certifications && (
                        <div>
                            <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 mb-2">Certifications</h4>
                            <p className="text-slate-600 text-[9px] italic leading-snug">{cvData.certifications}</p>
                        </div>
                    )}
                    {cvData.publications && (
                        <div>
                            <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 mb-2">Publications</h4>
                            <p className="text-slate-600 text-[9px] italic leading-snug">{cvData.publications}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
);

// Template 3: Elegant Layout (Split Sidebar View)
const ElegantTemplate = ({ cvData, selectedProjects }) => (
    <div className="w-full text-left bg-white grid grid-cols-12 min-h-[700px]">
        {/* Left Sidebar */}
        <div className="col-span-4 bg-slate-50 p-8 border-r border-slate-100 flex flex-col space-y-6">
            <div>
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight uppercase leading-tight">{cvData.fullName || "NAME"}</h2>
                <p className="text-blue-600 font-bold text-[8px] tracking-wider uppercase mt-1">{cvData.role}</p>
            </div>
            <div className="text-[9px] text-slate-600 space-y-2 pt-4 border-t border-slate-200">
                <p className="truncate">📧 {cvData.email || "email@example.com"}</p>
                <p>📞 {cvData.phone || "Phone"}</p>
            </div>
            <div className="pt-4 border-t border-slate-200">
                <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Education</h4>
                <p className="text-slate-700 text-[9px] font-bold uppercase leading-tight">{cvData.education}</p>
            </div>
            <div className="pt-4 border-t border-slate-200">
                <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Skills</h4>
                <div className="flex flex-wrap gap-1">
                    {cvData.skills?.split(',').map((s, i) => (
                        <span key={i} className="bg-white text-slate-700 px-1.5 py-0.5 rounded text-[8px] font-medium border border-slate-200 uppercase">{s.trim()}</span>
                    ))}
                </div>
            </div>
        </div>

        {/* Right Content */}
        <div className="col-span-8 p-8 space-y-6">
            <div>
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Profile Summary</h4>
                <p className="text-slate-600 text-[10px] leading-relaxed whitespace-pre-line">{cvData.summary}</p>
            </div>
            <div className="pt-4 border-t border-slate-100">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Key Projects</h4>
                <div className="space-y-4">
                    {selectedProjects.map((p, i) => (
                        <div key={i} className="space-y-1">
                            <div className="flex justify-between items-center">
                                <h5 className="text-[10px] font-bold text-slate-800 uppercase">{p.name}</h5>
                                <span className="text-[7px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">{p.tech}</span>
                            </div>
                            <p className="text-[9px] text-slate-500 leading-relaxed italic">{p.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
            {(cvData.certifications || cvData.publications) && (
                <div className="pt-4 border-t border-slate-100 space-y-4">
                    {cvData.certifications && (
                        <div>
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Certifications</h4>
                            <p className="text-slate-600 text-[9px] leading-snug italic font-medium">{cvData.certifications}</p>
                        </div>
                    )}
                    {cvData.publications && (
                        <div>
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Publications</h4>
                            <p className="text-slate-600 text-[9px] leading-snug italic font-medium">{cvData.publications}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
);



// ---------------------------------------------------------------------------
// 2. MAIN CV BUILDER COMPONENT
// UI redesign (Oct 2026): the builder form, buttons and messages use the new
// app style; messages are shown on the page instead of alert() popups. The
// three CV templates above (what goes into the PDF) are unchanged.
// ---------------------------------------------------------------------------

const TEMPLATES = [
    { key: 'modern', label: 'Modern', text: 'Dark header, two columns' },
    { key: 'minimal', label: 'Minimal', text: 'Classic, single column' },
    { key: 'elegant', label: 'Elegant', text: 'Side bar with skills' },
];
const MAX_PROJECTS = 4;

const CVBuilder = () => {
    const cvPreviewRef = useRef(null);

    const [cvData, setCvData] = useState({
        fullName: "",
        role: "",
        email: "",
        phone: "",
        summary: "",
        education: "",
        skills: "",
        certifications: "",
        publications: ""
    });

    const [githubRepos, setGithubRepos] = useState([]);
    const [selectedProjects, setSelectedProjects] = useState([]);
    const [githubUser, setGithubUser] = useState("");
    const [loading, setLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [message, setMessage] = useState(null);       // { tone, text } for the page
    const [githubError, setGithubError] = useState(''); // shown under the GitHub box

    // --- Active template ---
    const [selectedTemplate, setSelectedTemplate] = useState("modern");

    useEffect(() => {
        const fetchSavedData = async () => {
            const userId = localStorage.getItem('userId');
            if (userId) {
                try {
                    const response = await axios.get(`http://localhost:8000/get-cv/${userId}`);
                    if (response.data && response.data.user_id) {
                        const d = response.data;
                        setCvData({
                            fullName: d.full_name || "",
                            role: d.role || "",
                            email: d.email || "",
                            phone: d.phone || "",
                            summary: d.summary || "",
                            education: d.education || "",
                            skills: d.skills || "",
                            certifications: d.certifications || "",
                            publications: d.publications || ""
                        });
                        if (d.github_username) setGithubUser(d.github_username);
                    }
                } catch (err) {
                    console.error("Error fetching saved CV:", err);
                }
            }
        };
        fetchSavedData();
    }, []);

    const handleChange = (e) => {
        setCvData({ ...cvData, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            setMessage({ tone: 'error', text: 'Please log in first.' });
            return;
        }

        setSaveLoading(true);
        setMessage(null);
        const payload = {
            user_id: parseInt(userId),
            full_name: cvData.fullName,
            role: cvData.role,
            email: cvData.email,
            phone: cvData.phone,
            summary: cvData.summary,
            education: cvData.education,
            skills: cvData.skills,
            certifications: cvData.certifications,
            publications: cvData.publications,
            github_username: githubUser
        };

        try {
            const response = await axios.post("http://localhost:8000/save-cv", payload);
            setMessage({ tone: 'success', text: response.data.message || "Your CV details were saved." });
        } catch (err) {
            console.error("Save failed:", err);
            setMessage({ tone: 'error', text: "Could not save your CV details. Please try again." });
        } finally {
            setSaveLoading(false);
        }
    };

    const handleDownload = async () => {
        const element = cvPreviewRef.current;
        if (!element) return;

        setIsDownloading(true);
        setMessage(null);
        try {
            const canvas = await html2canvas(element, {
                scale: 3,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff",
            });

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            const pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight]);
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`${cvData.fullName || 'CV'}_${selectedTemplate.toUpperCase()}.pdf`);
        } catch (error) {
            console.error("Download Error:", error);
            setMessage({ tone: 'error', text: "Could not create the PDF. Please try again." });
        } finally {
            setIsDownloading(false);
        }
    };

    const fetchRepos = async () => {
        setGithubError('');
        if (!githubUser.trim()) {
            setGithubError("Please enter a GitHub username.");
            return;
        }
        setLoading(true);
        try {
            const response = await axios.get(`https://api.github.com/users/${githubUser.trim()}/repos?sort=updated`);
            setGithubRepos(response.data);
            if (!response.data.length) setGithubError("This GitHub user has no public repositories.");
        } catch {
            setGithubError("GitHub user not found, or GitHub could not be reached.");
        } finally {
            setLoading(false);
        }
    };

    const toggleProject = (repo) => {
        const isSelected = selectedProjects.find(p => p.id === repo.id);
        if (isSelected) {
            setSelectedProjects(selectedProjects.filter(p => p.id !== repo.id));
            setGithubError('');
        } else {
            if (selectedProjects.length >= MAX_PROJECTS) {
                setGithubError(`You can add up to ${MAX_PROJECTS} projects. Remove one first.`);
                return;
            }
            setSelectedProjects([...selectedProjects, {
                id: repo.id,
                name: repo.name,
                desc: repo.description || "Developing modern software solutions focused on performance and reliability.",
                tech: repo.language || "Tech Stack"
            }]);
        }
    };

    const input = (name, placeholder, extra = {}) => (
        <input id={`cv-${name}`} name={name} value={cvData[name]} placeholder={placeholder} onChange={handleChange} className={inputClass} {...extra} />
    );

    return (
        <div>
            <PageHeader
                title="CV builder"
                description="Fill in your details, add projects from GitHub, pick a layout and download your CV as a PDF."
                actions={
                    <>
                        <button type="button" onClick={handleSave} disabled={saveLoading} className={btn.secondary}>
                            {saveLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {saveLoading ? "Saving..." : "Save"}
                        </button>
                        <button type="button" onClick={handleDownload} disabled={isDownloading} className={btn.primary}>
                            {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            {isDownloading ? "Creating PDF..." : "Download PDF"}
                        </button>
                    </>
                }
            />

            {message && <Alert tone={message.tone} className="mt-5" onClose={() => setMessage(null)}>{message.text}</Alert>}

            <div className="mt-6 grid gap-6 xl:grid-cols-12">
                {/* --- Left: form --- */}
                <div className="min-w-0 space-y-5 xl:col-span-5">
                    <Card className="p-5">
                        <h2 className="text-sm font-semibold text-slate-900">Layout</h2>
                        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="CV layout">
                            {TEMPLATES.map((t) => {
                                const active = selectedTemplate === t.key;
                                return (
                                    <button
                                        key={t.key}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => setSelectedTemplate(t.key)}
                                        className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${active ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        <span className={`block text-sm font-medium ${active ? 'text-blue-700' : 'text-slate-800'}`}>{t.label}</span>
                                        <span className="mt-0.5 block text-xs text-slate-500">{t.text}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </Card>

                    <Card className="space-y-4 p-5">
                        <h2 className="text-sm font-semibold text-slate-900">Personal information</h2>
                        <Field id="cv-fullName" label="Full name">{input('fullName', 'e.g. Kasun Perera', { autoComplete: 'name' })}</Field>
                        <Field id="cv-role" label="Professional title">{input('role', 'e.g. Software Engineering Intern')}</Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field id="cv-email" label="Email">{input('email', 'you@example.com', { type: 'email', autoComplete: 'email' })}</Field>
                            <Field id="cv-phone" label="Phone">{input('phone', '+94 7x xxx xxxx', { type: 'tel', autoComplete: 'tel' })}</Field>
                        </div>
                    </Card>

                    <Card className="space-y-4 p-5">
                        <h2 className="text-sm font-semibold text-slate-900">Summary and qualifications</h2>
                        <Field id="cv-summary" label="Summary">
                            <textarea id="cv-summary" name="summary" value={cvData.summary} placeholder="A short description of your skills and goals..." onChange={handleChange} rows={4} className={`${inputClass} resize-y`} />
                        </Field>
                        <Field id="cv-education" label="Education">{input('education', 'e.g. BSc (Hons) IT, KDU (2023 - 2027)')}</Field>
                        <Field id="cv-skills" label="Skills" hint="Separate skills with commas.">
                            <textarea id="cv-skills" name="skills" value={cvData.skills} placeholder="React, Python, SQL, Git" onChange={handleChange} rows={2} className={`${inputClass} resize-y`} />
                        </Field>
                        <Field id="cv-certifications" label="Certifications">{input('certifications', 'Optional')}</Field>
                        <Field id="cv-publications" label="Publications">{input('publications', 'Optional')}</Field>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FolderGit2 size={16} /> Projects from GitHub</h2>
                            <span className="text-xs text-slate-500">{selectedProjects.length} / {MAX_PROJECTS} selected</span>
                        </div>
                        <form
                            className="mt-3 flex gap-2"
                            onSubmit={(e) => { e.preventDefault(); fetchRepos(); }}
                        >
                            <label htmlFor="cv-github" className="sr-only">GitHub username</label>
                            <input id="cv-github" placeholder="GitHub username" value={githubUser} onChange={(e) => setGithubUser(e.target.value)} className={inputClass} />
                            <button type="submit" disabled={loading} className={`${btn.secondary} shrink-0`}>
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                Load
                            </button>
                        </form>
                        {githubError && <p className="mt-2 text-xs text-red-600">{githubError}</p>}
                        {githubRepos.length > 0 && (
                            <ul className="mt-3 max-h-60 space-y-1.5 overflow-y-auto pr-1">
                                {githubRepos.map(repo => {
                                    const selected = !!selectedProjects.find(p => p.id === repo.id);
                                    return (
                                        <li key={repo.id}>
                                            <button
                                                type="button"
                                                onClick={() => toggleProject(repo)}
                                                aria-pressed={selected}
                                                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>
                                                    {selected && <Check size={12} strokeWidth={3} />}
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-slate-800">{repo.name}</span>
                                                {repo.language && <span className="shrink-0 text-xs text-slate-500">{repo.language}</span>}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Card>
                </div>

                {/* --- Right: live preview (this box is what goes into the PDF) --- */}
                <div className="min-w-0 xl:col-span-7">
                    <div className="xl:sticky xl:top-6">
                        <p className="mb-2 text-sm font-medium text-slate-500">Preview</p>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-3 sm:p-4">
                            <div
                                ref={cvPreviewRef}
                                className="mx-auto flex flex-col overflow-hidden bg-white shadow-sm"
                                style={{ width: '100%', minWidth: '560px', maxWidth: '800px' }}
                            >
                                {selectedTemplate === 'modern' && (
                                    <ModernTemplate cvData={cvData} selectedProjects={selectedProjects} />
                                )}
                                {selectedTemplate === 'minimal' && (
                                    <MinimalTemplate cvData={cvData} selectedProjects={selectedProjects} />
                                )}
                                {selectedTemplate === 'elegant' && (
                                    <ElegantTemplate cvData={cvData} selectedProjects={selectedProjects} />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CVBuilder;