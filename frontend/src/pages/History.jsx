import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Calendar, Target, Award, PlayCircle, Loader2, ArrowRight, Trash2, MessageSquare, Video } from 'lucide-react';

const History = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchingDetails, setFetchingDetails] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            const userId = localStorage.getItem("userId");
            if (!userId) {
                setLoading(false);
                return;
            }
            try {
                const response = await axios.get(`http://localhost:8000/api/interview-history/${userId}`);
                if (response.data.success) {
                    setHistory(response.data.history);
                }
            } catch (err) {
                console.error("Error fetching history:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const handleViewDetails = async (sessionId) => {
        setFetchingDetails(sessionId);
        try {
            const response = await axios.get(`http://localhost:8000/api/interview-session/${sessionId}`);
            if (response.data.success) {
                navigate('/interview-results', { state: { results: response.data.results } });
            }
        } catch (err) {
            console.error("Error fetching session details:", err);
            alert("Could not load interview details.");
        } finally {
            setFetchingDetails(null);
        }
    };

    const handleRemoveSession = async (sessionId, status) => {
        // --- BSc Research Feature (Suggestion #3): clearer confirmation
        // wording when deleting an incomplete ("Ongoing") session, since
        // this permanently discards a session that never finished -
        // different implication from deleting a completed report.
        const confirmMessage = status === 'Completed'
            ? "Are you sure you want to delete this interview session? This action cannot be undone."
            : "This session was never completed. Are you sure you want to delete it? This action cannot be undone.";
        if (!window.confirm(confirmMessage)) return;

        setDeletingId(sessionId);
        try {
            const response = await axios.delete(`http://localhost:8000/api/interview-session/${sessionId}`);
            if (response.data.success) {
                setHistory(history.filter(session => session.sessionId !== sessionId));
            }
        } catch (err) {
            console.error("Error deleting session:", err);
            alert("Could not delete the interview session.");
        } finally {
            setDeletingId(null);
        }
    };

    // --- BSc Research Feature (Suggestion #1, Critical): consistent
    // with this project's data-integrity policy applied everywhere else
    // - an "Ongoing" (incomplete) session has no real overallScore yet,
    // and previously displayed a blank/undefined number in the score
    // circle. Now explicitly shows "..." with a neutral color instead of
    // fabricating or blank-rendering a score that doesn't exist yet.
    const getScoreCircleStyle = (session) => {
        if (session.status !== 'Completed') {
            return { display: '...', color: 'bg-slate-300' };
        }
        // Completed but no Confidence Score: an older interview scored with
        // the previous formula (not comparable), or no camera/voice data.
        if (session.overallScore === null || session.overallScore === undefined) {
            return { display: 'N/A', color: 'bg-slate-300' };
        }
        const score = session.overallScore;
        return {
            display: Math.round(score),
            color: score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-orange-500' : 'bg-red-500',
        };
    };

    // --- BSc Research Feature (Suggestion #2): color-coded label for
    // the AI-Predicted Confidence Level, matching the styling
    // established on the Interview Results page.
    const getConfidenceBadgeStyle = (level) => {
        if (level === 'High Confidence') return 'bg-green-50 text-green-700 border-green-200';
        if (level === 'Moderate Confidence') return 'bg-orange-50 text-orange-700 border-orange-200';
        if (level === 'Low Confidence') return 'bg-red-50 text-red-700 border-red-200';
        return null; // NOT_AVAILABLE or missing - don't render a badge at all
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    const textInterviews = history.filter(session => session.interviewMode?.toUpperCase() === 'TEXT');
    const multimodalInterviews = history.filter(session => session.interviewMode?.toUpperCase() !== 'TEXT');

    const renderSessionList = (sessionsList, title, Icon) => {
        if (sessionsList.length === 0) return null;

        return (
            <div className="mb-10">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Icon size={24} className="text-blue-500" /> {title}
                </h2>
                <div className="grid gap-4">
                    {sessionsList.map((session, idx) => {
                        const scoreCircle = getScoreCircleStyle(session);
                        const confidenceBadgeClass = getConfidenceBadgeStyle(session.confidenceLevel);
                        return (
                            <div key={idx} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-white ${scoreCircle.color}`}>
                                        {scoreCircle.display}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-lg text-slate-800">{session.role}</h3>
                                            {confidenceBadgeClass && (
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${confidenceBadgeClass}`}>
                                                    {session.confidenceLevel}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">
                                            {new Date(session.createdAt).toLocaleDateString()} • {session.interviewMode} Mode{session.difficulty ? ` • ${session.difficulty}` : ''}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${session.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {session.status}
                                    </span>

                                    {session.status === 'Completed' && (
                                        <button
                                            onClick={() => handleViewDetails(session.sessionId)}
                                            disabled={fetchingDetails === session.sessionId || deletingId === session.sessionId}
                                            className="ml-auto md:ml-0 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {fetchingDetails === session.sessionId ? <Loader2 size={14} className="animate-spin" /> : "View Details"}
                                            <ArrowRight size={14} />
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleRemoveSession(session.sessionId, session.status)}
                                        disabled={deletingId === session.sessionId || fetchingDetails === session.sessionId}
                                        className="bg-red-50 hover:bg-red-100 text-red-500 p-2 rounded-xl transition-all disabled:opacity-50"
                                        title="Delete session"
                                    >
                                        {deletingId === session.sessionId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    </button>
                                </div>

                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 md:p-10 animate-in fade-in duration-500 max-w-6xl mx-auto">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3 mb-8">
                <Calendar className="text-blue-500" size={32} />
                Interview History
            </h1>

            {history.length === 0 ? (
                <div className="bg-slate-50 border border-slate-100 p-10 rounded-[2rem] text-center shadow-sm">
                    <p className="text-slate-500 font-medium">You haven't completed any mock interviews yet.</p>
                    <button
                        onClick={() => navigate('/InterviewSetup')}
                        className="mt-6 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-colors inline-flex items-center gap-2"
                    >
                        Start Your First Interview <PlayCircle size={18} />
                    </button>
                </div>
            ) : (
                <>
                    {renderSessionList(multimodalInterviews, "Multimodal Interviews", Video)}
                    {renderSessionList(textInterviews, "Text-Only Interviews", MessageSquare)}
                </>
            )}
        </div>
    );
};

export default History;