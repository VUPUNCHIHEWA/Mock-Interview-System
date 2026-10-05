import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LayoutDashboard, TrendingUp, TrendingDown, Minus, Loader2, AlertCircle, Rocket, Calendar, SlidersHorizontal } from 'lucide-react';

// --- BSc Research Feature (Step 5): ⭐ Progress Tracker page - core
// research contribution UI, displays the comparison between a user's
// earliest and most recent completed sessions (see progress_tracker.py).
//
// --- BSc Research Feature (User-Selectable Comparison): the student
// now explicitly selects which role/difficulty/interview-mode
// combination to view progress for, via 3 dropdowns populated only
// with combinations that actually have 2+ comparable sessions - giving
// full transparency and control over exactly what is being compared,
// rather than a black-box auto-selected group.
const ProgressPage = () => {
    const navigate = useNavigate();
    const [options, setOptions] = useState([]);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [selectedKey, setSelectedKey] = useState(null); // "role|difficulty|mode" string
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const userId = localStorage.getItem("userId") || 1;

    // Step 1: fetch available comparison options (populates dropdown)
    useEffect(() => {
        axios.get(`http://localhost:8000/api/progress-options/${userId}`)
            .then(response => {
                const opts = response.data.options || [];
                setOptions(opts);
                setOptionsLoading(false);
                // Auto-select the first (most-data-rich) option by default,
                // so the page isn't empty on first load - student can still
                // change the selection afterward.
                if (opts.length > 0) {
                    const first = opts[0];
                    setSelectedKey(`${first.role}|${first.difficulty}|${first.interview_mode}`);
                }
            })
            .catch(err => {
                console.error("Failed to fetch progress options:", err);
                setOptionsLoading(false);
            });
    }, []);

    // Step 2: whenever the selection changes, fetch progress for that combination
    useEffect(() => {
        if (!selectedKey) return;
        const [role, difficulty, mode] = selectedKey.split('|');
        setLoading(true);
        setError(null);
        axios.get(`http://localhost:8000/api/progress/${userId}`, {
            params: { role, difficulty, mode }
        })
            .then(response => {
                setProgress(response.data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch progress:", err);
                setError("Could not load progress data.");
                setLoading(false);
            });
    }, [selectedKey]);

    const getTrendIcon = (trend) => {
        if (trend === "Improved") return <TrendingUp className="text-green-500" size={20} />;
        if (trend === "Declined") return <TrendingDown className="text-red-500" size={20} />;
        return <Minus className="text-slate-400" size={20} />;
    };

    const getTrendColor = (trend) => {
        if (trend === "Improved") return "text-green-600 bg-green-50 border-green-200";
        if (trend === "Declined") return "text-red-600 bg-red-50 border-red-200";
        return "text-slate-500 bg-slate-50 border-slate-200";
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 animate-in fade-in duration-700">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex justify-between items-center">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="group flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-all font-bold text-[10px] uppercase tracking-[0.2em]"
                    >
                        <LayoutDashboard size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                    </button>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Your Progress</h1>
                    <p className="text-slate-500 mt-2 font-medium">Select a role, difficulty, and mode combination to compare your sessions.</p>
                </div>

                {/* --- BSc Research Feature (User-Selectable Comparison):
                    dropdown populated ONLY with combinations that have 2+
                    comparable sessions - the student cannot select an
                    invalid/incomparable combination. */}
                {!optionsLoading && options.length > 0 && (
                    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                            <SlidersHorizontal size={14} /> Compare Sessions For:
                        </p>
                        <select
                            value={selectedKey || ''}
                            onChange={(e) => setSelectedKey(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                        >
                            {options.map((opt) => {
                                const key = `${opt.role}|${opt.difficulty}|${opt.interview_mode}`;
                                return (
                                    <option key={key} value={key}>
                                        {opt.role} · {opt.difficulty} · {opt.interview_mode} ({opt.session_count} sessions)
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                )}

                {!optionsLoading && options.length === 0 && (
                    <div className="bg-white border border-slate-100 rounded-[2rem] p-10 shadow-sm text-center">
                        <AlertCircle className="mx-auto text-slate-400 mb-4" size={40} />
                        <p className="text-slate-600 font-medium mb-6">
                            No comparable session pairs yet. Complete 2 sessions with the SAME role, difficulty, and
                            interview mode to unlock progress tracking.
                        </p>
                        <button
                            onClick={() => navigate('/InterviewSetup')}
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                        >
                            <Rocket size={16} /> Start Another Session
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                        <p className="text-slate-500 font-medium">Loading your progress...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 font-medium">
                        {error}
                    </div>
                )}

                {/* Suggestion #4: direct "Start Another Session" button when
                    not enough completed sessions exist yet - previously the
                    student had to manually navigate back to find this. */}
                {!loading && !error && progress && !progress.available && (
                    <div className="bg-white border border-slate-100 rounded-[2rem] p-10 shadow-sm text-center">
                        <AlertCircle className="mx-auto text-slate-400 mb-4" size={40} />
                        <p className="text-slate-600 font-medium mb-6">{progress.message}</p>
                        <button
                            onClick={() => navigate('/InterviewSetup')}
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                        >
                            <Rocket size={16} /> Start Another Session
                        </button>
                    </div>
                )}

                {!loading && !error && progress && progress.available && (
                    <div className="space-y-6">

                        {/* Focus Area */}
                        {progress.focus_area && (
                            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-[2rem] p-8 shadow-xl shadow-blue-200 text-white">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 mb-2">
                                    🎯 Recommended Focus for Next Session
                                </p>
                                <h3 className="text-2xl font-black mb-3">{progress.focus_area.area}</h3>
                                <p className="text-sm font-medium leading-relaxed opacity-90">{progress.focus_area.tip}</p>
                            </div>
                        )}

                        {/* Session dates */}
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">First Session</p>
                                <p className="text-sm font-bold text-slate-700 mt-1">
                                    {progress.comparison.session_old.date ? new Date(progress.comparison.session_old.date).toLocaleDateString() : "N/A"}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                    {progress.comparison.session_old.role} · {progress.comparison.session_old.difficulty}
                                </p>
                            </div>
                            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Latest Session</p>
                                <p className="text-sm font-bold text-slate-700 mt-1">
                                    {progress.comparison.session_new.date ? new Date(progress.comparison.session_new.date).toLocaleDateString() : "N/A"}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                    {progress.comparison.session_new.role} · {progress.comparison.session_new.difficulty}
                                </p>
                            </div>
                        </div>

                        {/* Score comparison bars */}
                        <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-6">Score Comparison</h3>
                            <div className="space-y-6">
                                {[
                                    { label: '📝 Overall Score', oldVal: progress.comparison.session_old.overall_score, newVal: progress.comparison.session_new.overall_score },
                                    { label: '🎥 Visual Confidence', oldVal: progress.comparison.session_old.visual_score, newVal: progress.comparison.session_new.visual_score },
                                    { label: '🎙️ Vocal Delivery', oldVal: progress.comparison.session_old.vocal_score, newVal: progress.comparison.session_new.vocal_score },
                                ].map((row, i) => (
                                    <div key={i}>
                                        <p className="text-xs font-bold text-slate-600 mb-2">{row.label}</p>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black uppercase text-blue-400 w-20 shrink-0">First</span>
                                                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-300 rounded-full transition-all duration-1000 flex items-center justify-end pr-2"
                                                        style={{ width: `${row.oldVal ?? 0}%` }}
                                                    >
                                                        <span className="text-[9px] font-black text-blue-900">{row.oldVal ?? 'N/A'}{row.oldVal !== null ? '%' : ''}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black uppercase text-green-500 w-20 shrink-0">Latest</span>
                                                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-green-400 rounded-full transition-all duration-1000 flex items-center justify-end pr-2"
                                                        style={{ width: `${row.newVal ?? 0}%` }}
                                                    >
                                                        <span className="text-[9px] font-black text-green-900">{row.newVal ?? 'N/A'}{row.newVal !== null ? '%' : ''}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Progress Messages */}
                        <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-6">Summary</h3>
                            <div className="space-y-3">
                                {progress.messages.map((msg, i) => (
                                    <p key={i} className="text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-xl">
                                        {msg}
                                    </p>
                                ))}
                            </div>
                        </div>

                        {/* Detailed Comparison */}
                        <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-6">Detailed Comparison</h3>
                            <div className="space-y-4">

                                <div className={`flex items-center justify-between p-4 rounded-xl border ${getTrendColor(progress.comparison.overall_score_trend)}`}>
                                    <span className="text-sm font-bold">Overall Score</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs">{progress.comparison.session_old.overall_score}% → {progress.comparison.session_new.overall_score}%</span>
                                        {getTrendIcon(progress.comparison.overall_score_trend)}
                                    </div>
                                </div>

                                <div className={`flex items-center justify-between p-4 rounded-xl border ${getTrendColor(progress.comparison.visual_score_trend)}`}>
                                    <span className="text-sm font-bold">Visual Confidence</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs">{progress.comparison.session_old.visual_score ?? "N/A"}% → {progress.comparison.session_new.visual_score ?? "N/A"}%</span>
                                        {getTrendIcon(progress.comparison.visual_score_trend)}
                                    </div>
                                </div>

                                <div className={`flex items-center justify-between p-4 rounded-xl border ${getTrendColor(progress.comparison.vocal_score_trend)}`}>
                                    <span className="text-sm font-bold">Vocal Delivery</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs">{progress.comparison.session_old.vocal_score ?? "N/A"}% → {progress.comparison.session_new.vocal_score ?? "N/A"}%</span>
                                        {getTrendIcon(progress.comparison.vocal_score_trend)}
                                    </div>
                                </div>

                                <div className={`flex items-center justify-between p-4 rounded-xl border ${getTrendColor(progress.comparison.confidence_trend)}`}>
                                    <span className="text-sm font-bold">🌳 AI-Predicted Confidence</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs">{progress.comparison.confidence_level_old} → {progress.comparison.confidence_level_new}</span>
                                        {getTrendIcon(progress.comparison.confidence_trend)}
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* --- BSc Research Feature (Suggestion #1): full session
                            trend table - previously ONLY the first and latest
                            sessions were visible anywhere on this page; any
                            sessions in between were completely invisible to the
                            student even though they represent real progress
                            data. This restores that visibility without
                            changing the core first-vs-latest comparison logic
                            above (kept for the fixed-length-session validity
                            reasoning already established). */}
                        {progress.all_sessions && progress.all_sessions.length > 2 && (
                            <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-2 flex items-center gap-2">
                                    <Calendar size={14} /> All Sessions ({progress.total_completed_sessions})
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium mb-6">
                                    The comparison above only uses your first and latest session for consistency -
                                    here's your full history for reference.
                                </p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                                <th className="pb-3 pr-4">Date</th>
                                                <th className="pb-3 pr-4">Role</th>
                                                <th className="pb-3 pr-4">Difficulty</th>
                                                <th className="pb-3 pr-4">Overall Score</th>
                                                <th className="pb-3">AI Confidence</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {progress.all_sessions.map((s, i) => (
                                                <tr key={s.session_id} className={`text-sm border-b border-slate-50 ${i === 0 || i === progress.all_sessions.length - 1 ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                                                    <td className="py-3 pr-4">
                                                        {s.date ? new Date(s.date).toLocaleDateString() : "N/A"}
                                                        {i === 0 && <span className="ml-2 text-[9px] text-blue-500 uppercase font-black">First</span>}
                                                        {i === progress.all_sessions.length - 1 && <span className="ml-2 text-[9px] text-green-500 uppercase font-black">Latest</span>}
                                                    </td>
                                                    <td className="py-3 pr-4">{s.role}</td>
                                                    <td className="py-3 pr-4">{s.difficulty}</td>
                                                    <td className="py-3 pr-4">{s.overall_score !== null ? `${s.overall_score}%` : "N/A"}</td>
                                                    <td className="py-3">{s.confidence_level}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgressPage;