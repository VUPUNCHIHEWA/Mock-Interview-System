import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Video, MessageSquare, Trash2, Loader2, ArrowRight } from 'lucide-react';
import {
    PageHeader, Card, Alert, PageLoader, EmptyState, ConfirmDialog, ScoreTile, StatusBadge, btn, fmtDateTime,
} from '../components/Ui';

const API = "http://localhost:8000";

// ---------------------------------------------------------------------------
// My interviews: every standard interview (Custom Practice is kept out, D7).
// UI redesign (Oct 2026): one clean list, newest first; delete asks in an
// in-app dialog instead of window.confirm(); errors shown on the page.
// The AI-predicted confidence level badge is not shown (ASSUMPTIONS I18).
// ---------------------------------------------------------------------------

const History = () => {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openingId, setOpeningId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [toDelete, setToDelete] = useState(null); // session waiting for confirmation

    useEffect(() => {
        const fetchHistory = async () => {
            const userId = localStorage.getItem("userId");
            if (!userId) {
                navigate('/login', { replace: true });
                return;
            }
            try {
                const response = await axios.get(`${API}/api/interview-history/${userId}`);
                if (response.data.success) setHistory(response.data.history || []);
            } catch (err) {
                console.error("Error fetching history:", err);
                setError("Could not load your interviews. Please check that the backend is running.");
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [navigate]);

    const openReport = async (sessionId) => {
        setError('');
        setOpeningId(sessionId);
        try {
            const response = await axios.get(`${API}/api/interview-session/${sessionId}`);
            if (response.data.success) navigate('/interview-results', { state: { results: response.data.results } });
        } catch (err) {
            console.error("Error fetching session details:", err);
            setError("Could not open that report. Please try again.");
        } finally {
            setOpeningId(null);
        }
    };

    const confirmDelete = async () => {
        const session = toDelete;
        if (!session) return;
        setDeletingId(session.sessionId);
        setError('');
        try {
            const response = await axios.delete(`${API}/api/interview-session/${session.sessionId}`);
            if (response.data.success) setHistory(prev => prev.filter(s => s.sessionId !== session.sessionId));
            setToDelete(null);
        } catch (err) {
            console.error("Error deleting session:", err);
            setError("Could not delete the interview. Please try again.");
            setToDelete(null);
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) return <PageLoader />;

    const completedCount = history.filter(s => s.status === 'Completed').length;
    const hasText = history.some(s => s.interviewMode?.toUpperCase() === 'TEXT');

    return (
        <div>
            <PageHeader
                title="My interviews"
                description="Every mock interview you have done, newest first. Open a report to see your confidence feedback again."
                actions={
                    <Link to="/InterviewSetup" className={btn.primary}>
                        <Video size={16} /> New interview
                    </Link>
                }
            />

            {error && <Alert tone="error" className="mt-5" onClose={() => setError('')}>{error}</Alert>}

            <div className="mt-6">
                {history.length === 0 ? (
                    <EmptyState
                        icon={Video}
                        title="No interviews yet"
                        text="Your interviews will be listed here after you finish your first one."
                        action={<Link to="/InterviewSetup" className={btn.primary}>Start your first interview <ArrowRight size={16} /></Link>}
                    />
                ) : (
                    <Card>
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm text-slate-500 sm:px-6">
                            <span>{history.length} interview{history.length === 1 ? '' : 's'}</span>
                            <span>{completedCount} completed</span>
                        </div>
                        <ul className="divide-y divide-slate-100">
                            {history.map((session) => {
                                const done = session.status === 'Completed';
                                const isText = session.interviewMode?.toUpperCase() === 'TEXT';
                                const busy = openingId === session.sessionId || deletingId === session.sessionId;
                                return (
                                    <li key={session.sessionId} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                                        <div className="flex min-w-0 flex-1 items-center gap-4">
                                            <ScoreTile score={session.overallScore} finished={done} />
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-slate-900">
                                                    {fmtDateTime(session.createdAt)}
                                                </p>
                                                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                                    <span className="inline-flex items-center gap-1">
                                                        {isText ? <MessageSquare size={13} /> : <Video size={13} />}
                                                        {isText ? 'Text only' : 'Voice + camera'}
                                                    </span>
                                                    {session.role && session.role !== 'General Interview' && <span>{session.role}</span>}
                                                    {session.difficulty && <span>{session.difficulty}</span>}
                                                    <StatusBadge completed={done} />
                                                </p>
                                                {done && session.overallScore == null && (
                                                    <p className="mt-0.5 text-xs text-slate-400">No confidence score (older scoring, or no camera/voice data)</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:shrink-0">
                                            {done && (
                                                <button
                                                    type="button"
                                                    onClick={() => openReport(session.sessionId)}
                                                    disabled={busy}
                                                    className={`${btn.secondary} py-2`}
                                                >
                                                    {openingId === session.sessionId ? <Loader2 size={15} className="animate-spin" /> : null}
                                                    View report
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setToDelete(session)}
                                                disabled={busy}
                                                className={`${btn.icon} ml-auto hover:bg-red-50 hover:text-red-600 sm:ml-0`}
                                                aria-label="Delete interview"
                                                title="Delete interview"
                                            >
                                                {deletingId === session.sessionId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </Card>
                )}
                {hasText && (
                    <p className="mt-3 text-xs text-slate-500">Text-only interviews have an answer score but no confidence score.</p>
                )}
            </div>

            <ConfirmDialog
                open={!!toDelete}
                danger
                title="Delete this interview?"
                message={toDelete?.status === 'Completed'
                    ? "The report and its scores will be removed from your history and progress. This cannot be undone."
                    : "This interview was never finished. It will be removed. This cannot be undone."}
                confirmLabel="Delete"
                busy={!!deletingId}
                onConfirm={confirmDelete}
                onCancel={() => setToDelete(null)}
            />
        </div>
    );
};

export default History;