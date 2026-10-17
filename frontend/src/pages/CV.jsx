import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { APP_NAME } from '../config/Brand';





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



// 2. MAIN CV BUILDER COMPONENT

const CVBuilder = () => {
    const cvPreviewRef = useRef(null);

    const [cvData, setCvData] = useState({
        fullName: "",
        role: "Software Quality Assurance Intern",
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
    
    // --- New State for handling active template ---
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
                        if(d.github_username) setGithubUser(d.github_username);
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
        if (!userId) return alert("Please login first!");

        setSaveLoading(true);
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
            alert(response.data.message || "Data saved successfully!");
        } catch (err) {
            console.error("Save failed:", err);
            alert("Failed to save data.");
        } finally {
            setSaveLoading(false);
        }
    };

    const handleDownload = async () => {
        const element = cvPreviewRef.current;
        if (!element) return;

        setIsDownloading(true);
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
            alert("Could not generate PDF.");
        } finally {
            setIsDownloading(false);
        }
    };

    const fetchRepos = async () => {
        if (!githubUser) return alert("Please enter GitHub username");
        setLoading(true);
        try {
            const response = await axios.get(`https://api.github.com/users/${githubUser}/repos?sort=updated`);
            setGithubRepos(response.data);
        } catch (err) { 
            alert("GitHub User not found!"); 
        } finally { 
            setLoading(false); 
        }
    };

    const toggleProject = (repo) => {
        const isSelected = selectedProjects.find(p => p.id === repo.id);
        if (isSelected) {
            setSelectedProjects(selectedProjects.filter(p => p.id !== repo.id));
        } else {
            if (selectedProjects.length >= 4) return alert("Maximum 4 projects allowed.");
            setSelectedProjects([...selectedProjects, {
                id: repo.id,
                name: repo.name,
                desc: repo.description || "Developing modern software solutions focused on performance and reliability.",
                tech: repo.language || "Tech Stack"
            }]);
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-6 animate-in fade-in duration-700 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                
                {/* --- Left Side: Configuration Fields --- */}
                <div className="lg:col-span-5 space-y-12 pb-20">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">CV BUILDER</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time profile sync</p>
                        </div>
                        <button 
                            onClick={handleSave}
                            disabled={saveLoading}
                            className="bg-blue-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-900 transition-all shadow-lg disabled:bg-slate-400"
                        >
                            {saveLoading ? "Saving..." : "Save to Profile"}
                        </button>
                    </div>

                    {/* --- NEW: Template Selection Section --- */}
                    <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] flex items-center gap-3">
                            <span className="w-8 h-[1px] bg-slate-700"></span> Choose Layout Design
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                            {['modern', 'minimal', 'elegant'].map((temp) => (
                                <button
                                    key={temp}
                                    onClick={() => setSelectedTemplate(temp)}
                                    className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase transition-all tracking-wider ${
                                        selectedTemplate === temp 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                >
                                    {temp}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-3">
                            <span className="w-8 h-[1px] bg-blue-600"></span> Personal Information
                        </h4>
                        <div className="grid grid-cols-1 gap-5">
                            <input name="fullName" value={cvData.fullName} placeholder="Full Name" onChange={handleChange} className="w-full bg-transparent border-b-2 border-slate-100 py-3 focus:border-blue-500 outline-none text-sm font-bold" />
                            <input name="role" value={cvData.role} placeholder="Professional Role" onChange={handleChange} className="w-full bg-transparent border-b-2 border-slate-100 py-3 focus:border-blue-500 outline-none text-sm font-bold" />
                            <div className="grid grid-cols-2 gap-5">
                                <input name="email" value={cvData.email} placeholder="Email" onChange={handleChange} className="w-full bg-transparent border-b-2 border-slate-100 py-3 focus:border-blue-500 outline-none text-xs" />
                                <input name="phone" value={cvData.phone} placeholder="Phone" onChange={handleChange} className="w-full bg-transparent border-b-2 border-slate-100 py-3 focus:border-blue-500 outline-none text-xs" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-3">
                            <span className="w-8 h-[1px] bg-blue-600"></span> Summary
                        </h4>
                        <textarea name="summary" value={cvData.summary} placeholder="A short description about yourself..." onChange={handleChange} className="w-full bg-slate-50 p-5 rounded-2xl border-none text-xs leading-relaxed outline-none focus:ring-2 focus:ring-blue-100 min-h-[100px]" />
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-3">
                            <span className="w-8 h-[1px] bg-blue-600"></span> Qualifications
                        </h4>
                        <input name="education" value={cvData.education} placeholder="Education" onChange={handleChange} className="w-full bg-transparent border-b-2 border-slate-100 py-3 focus:border-blue-500 outline-none text-xs font-bold" />
                        <textarea name="skills" value={cvData.skills} placeholder="Skills (comma separated)" onChange={handleChange} className="w-full bg-transparent border-b-2 border-slate-100 py-3 focus:border-blue-500 outline-none text-xs" />
                        <input name="certifications" value={cvData.certifications} placeholder="Certifications" onChange={handleChange} className="w-full bg-transparent border-b-2 border-slate-100 py-3 focus:border-blue-500 outline-none text-xs" />
                        <input name="publications" value={cvData.publications} placeholder="Publications" onChange={handleChange} className="w-full bg-transparent border-b-2 border-slate-100 py-3 focus:border-blue-500 outline-none text-xs" />
                    </div>

                    <div className="space-y-6 pt-4">
                        <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
                            <span className="w-8 h-[1px] bg-slate-800"></span> GitHub Integration
                        </h4>
                        <div className="flex gap-3">
                            <input placeholder="Username" value={githubUser} onChange={(e)=>setGithubUser(e.target.value)} className="flex-1 bg-slate-100 px-5 py-3 rounded-xl text-xs font-bold outline-none" />
                            <button onClick={fetchRepos} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all">
                                {loading ? "..." : "Sync"}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                            {githubRepos.map(repo => (
                                <div key={repo.id} onClick={() => toggleProject(repo)} className={`p-3 rounded-xl border-2 cursor-pointer text-[10px] font-bold flex justify-between items-center transition-all ${selectedProjects.find(p => p.id === repo.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-50 bg-white hover:border-slate-200'}`}>
                                    <span className="truncate w-40 uppercase">{repo.name}</span>
                                    {selectedProjects.find(p => p.id === repo.id) ? <span className="text-blue-600">SELECTED</span> : <span className="text-slate-300">+</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- Right Side: CV Preview Wrapper --- */}
                <div className="lg:col-span-7">
                    <div 
                        ref={cvPreviewRef} 
                        className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 flex flex-col mx-auto overflow-hidden"
                        style={{ width: '100%', maxWidth: '800px' }}
                    >
                        {/* --- CONDITIONAL RENDERING BASED ON CHOSEN TEMPLATE --- */}
                        {selectedTemplate === 'modern' && (
                            <ModernTemplate cvData={cvData} selectedProjects={selectedProjects} />
                        )}
                        {selectedTemplate === 'minimal' && (
                            <MinimalTemplate cvData={cvData} selectedProjects={selectedProjects} />
                        )}
                        {selectedTemplate === 'elegant' && (
                            <ElegantTemplate cvData={cvData} selectedProjects={selectedProjects} />
                        )}

                        {/* PDF Footer Component (Hidden from actual PDF, only visible in browser preview) */}
                        <div className="p-8 bg-slate-50 flex justify-between items-center border-t border-slate-100" data-html2canvas-ignore="true">
                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-[0.4em]">Generated by {APP_NAME}</span>
                            <button 
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-[9px] uppercase hover:bg-slate-900 transition-all disabled:bg-slate-400"
                            >
                                {isDownloading ? "Generating PDF..." : "Download PDF"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CVBuilder;