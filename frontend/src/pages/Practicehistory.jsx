import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { History, Loader2, ArrowRight, Trash2, ListPlus, ChevronDown, ChevronUp, Info } from 'lucide-react';

// ---------------------------------------------------------------------------
// Practice History - SUPPORTING FEATURE (Custom Practice only).
//
// Lists the student's Custom Practice sessions so a practice report can be
// opened again. Kept SEPARATE from "My Interviews" and the Progress page,
// which show only the standard interviews used in the study (D7, D11).
// ---------------------------------------------------------------------------

const API = "http://localhost:8000";

const scoreStyle = (session) => {
    if (session.status !== 'Completed') return { display: '...', color: 'bg-slate-300' };
    if (session.overallScore === null || session.overallScore === undefined) return { display: 'N/A', color: 'bg-slate-300' };
    const s = session.overallScore;
    return { display: Math.round(s), color: s >= 80 ? 'bg-green-500' : s >= 60 ? 'bg-orange-500' : 'bg-red-500' };
};

const confidenceBadge = (level) => {
    if (level === 'High Confidence') return 'bg-green-50 text-green-700 border-green-200';
    if (level === 'Moderate Confidence') return 'bg-orange-50 text-orange-700 border-orange-200';
    if (level === 'Low Confidence') return 'bg-red-50 text-red-700 border-red-200';
    return null;
};

const PracticeHistory = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openingId, setOpeningId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        const load = async () => {
            const userId = localStorage.getItem("userId");
            if (!userId) { setLoading(false); return; }
            try {
                const res = await axios.get(`${API}/api/practice-history/${userId}`);
                if (res.data.success) setItems(res.data.history || []);
            } catch (err) {
                console.error("Error fetching practice history:", err);
                setError("Could not load your practice history. Check that the backend is running.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const openReport = async (sessionId) => {
        setOpeningId(sessionId);
        try {
            const res = await axios.get(`${API}/api/interview-session/${sessionId}`);
            if (res.data.success) navigate('/interview-results', { state: { results: res.data.results } });
        } catch (err) {
            console.error("Error opening practice report:", err);
            alert("Could not open this practice report.");
        } finally {
            setOpeningId(null);
        }
    };

    const removeSession = async (session) => {
        const msg = session.status === 'Completed'
            ? "Delete this practice session? This cannot be undone."
            : "This practice session was never finished. Delete it? This cannot be undone.";
        if (!window.confirm(msg)) return;
        setDeletingId(session.sessionId);
        try {
            const res = await axios.delete(`${API}/api/interview-session/${session.sessionId}`);
            if (res.data.success) setItems(prev => prev.filter(s => s.sessionId !== session.sessionId));
        } catch (err) {
            console.error("Error deleting practice session:", err);
            alert("Could not delete this practice session.");
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    return (
        <div className="p-6 md:p-10 animate-in fade-in duration-500 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
                    <History className="text-blue-500" size={32} />
                    Practice History
                </h1>
                <button
                    onClick={() => navigate('/custom-practice')}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest inline-flex items-center gap-2 transition-all active:scale-95"
                >
                    <ListPlus size={15} /> New Custom Practice
                </button>
            </div>

            <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex gap-2 items-start mb-8">
                <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-900/80 font-medium leading-relaxed">
                    Your Custom Practice sessions (your own questions). They are kept separate from My Interviews and your
                    progress, because your own questions are not the same for every session, so these scores cannot be
                    compared with the standard interviews.
                </p>
            </div>

            {error && <p className="text-sm font-semibold text-red-600 mb-6">{error}</p>}

            {items.length === 0 && !error ? (
                <div className="bg-slate-50 border border-slate-100 p-10 rounded-[2rem] text-center shadow-sm">
                    <p className="text-slate-500 font-medium">You haven't done any Custom Practice yet.</p>
                    <button
                        onClick={() => navigate('/custom-practice')}
                        className="mt-6 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-colors inline-flex items-center gap-2"
                    >
                        Practise with your own questions <ArrowRight size={18} />
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {items.map((session) => {
                        const score = scoreStyle(session);
                        const badge = confidenceBadge(session.confidenceLevel);
                        const busy = openingId === session.sessionId || deletingId === session.sessionId;
                        const expanded = expandedId === session.sessionId;
                        const preview = session.questions?.[0];
                        return (
                            <div key={session.sessionId} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-white shrink-0 ${score.color}`}>
                                            {score.display}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-lg text-slate-800">Custom Practice</h3>
                                                {badge && (
                                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${badge}`}>
                                                        {session.confidenceLevel}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">
                                                {new Date(session.createdAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                {' • '}{session.questionCount} question{session.questionCount === 1 ? '' : 's'}
                                            </p>
                                            {preview && !expanded && (
                                                <p className="text-sm text-slate-500 mt-1 truncate max-w-xl">“{preview}”{session.questionCount > 1 ? ' …' : ''}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${session.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {session.status === 'Completed' ? 'Completed' : 'Not finished'}
                                        </span>
                                        {session.questionCount > 0 && (
                                            <button
                                                onClick={() => setExpandedId(expanded ? null : session.sessionId)}
                                                className="text-slate-500 hover:text-slate-800 px-2 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1"
                                            >
                                                Questions {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        )}
                                        {session.status === 'Completed' && (
                                            <button
                                                onClick={() => openReport(session.sessionId)}
                                                disabled={busy}
                                                className="ml-auto md:ml-0 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {openingId === session.sessionId ? <Loader2 size={14} className="animate-spin" /> : 'View Report'}
                                                <ArrowRight size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => removeSession(session)}
                                            disabled={busy}
                                            className="bg-red-50 hover:bg-red-100 text-red-500 p-2 rounded-xl transition-all disabled:opacity-50"
                                            title="Delete practice session"
                                        >
                                            {deletingId === session.sessionId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {expanded && (
                                    <ol className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 list-decimal pl-5 text-sm text-slate-600 font-medium">
                                        {session.questions.map((q, i) => <li key={i}>{q}</li>)}
                                    </ol>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PracticeHistory;