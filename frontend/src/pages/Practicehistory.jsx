import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Trash2, ListPlus, ChevronDown, Loader2 } from 'lucide-react';
import {
    PageHeader, Card, Alert, PageLoader, EmptyState, ConfirmDialog, ScoreTile, StatusBadge, btn, fmtDateTime,
} from '../components/Ui';

// ---------------------------------------------------------------------------
// Practice History - SUPPORTING FEATURE (Custom Practice only).
//
// Lists the student's Custom Practice sessions so a practice report can be
// opened again. Kept SEPARATE from "My Interviews" and the Progress page,
// which show only the standard interviews used in the study (D7, D11).
// UI redesign (Oct 2026): same data and actions; in-app delete dialog and
// on-page errors instead of window.confirm()/alert().
// ---------------------------------------------------------------------------

const API = "http://localhost:8000";

const PracticeHistory = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openingId, setOpeningId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [toDelete, setToDelete] = useState(null);

    useEffect(() => {
        const load = async () => {
            const userId = localStorage.getItem("userId");
            if (!userId) { navigate('/login', { replace: true }); return; }
            try {
                const res = await axios.get(`${API}/api/practice-history/${userId}`);
                if (res.data.success) setItems(res.data.history || []);
            } catch (err) {
                console.error("Error fetching practice history:", err);
                setError("Could not load your practice history. Please check that the backend is running.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [navigate]);

    const openReport = async (sessionId) => {
        setError(null);
        setOpeningId(sessionId);
        try {
            const res = await axios.get(`${API}/api/interview-session/${sessionId}`);
            if (res.data.success) navigate('/interview-results', { state: { results: res.data.results } });
        } catch (err) {
            console.error("Error opening practice report:", err);
            setError("Could not open this practice report. Please try again.");
        } finally {
            setOpeningId(null);
        }
    };

    const confirmDelete = async () => {
        const session = toDelete;
        if (!session) return;
        setDeletingId(session.sessionId);
        setError(null);
        try {
            const res = await axios.delete(`${API}/api/interview-session/${session.sessionId}`);
            if (res.data.success) setItems(prev => prev.filter(s => s.sessionId !== session.sessionId));
        } catch (err) {
            console.error("Error deleting practice session:", err);
            setError("Could not delete this practice session. Please try again.");
        } finally {
            setDeletingId(null);
            setToDelete(null);
        }
    };

    if (loading) return <PageLoader />;

    return (
        <div>
            <Link to="/custom-practice" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-800">
                <ArrowLeft size={16} /> Custom practice
            </Link>
            <div className="mt-4">
                <PageHeader
                    title="Practice history"
                    description="Your Custom Practice sessions with your own questions."
                    actions={
                        <Link to="/custom-practice" className={btn.primary}>
                            <ListPlus size={16} /> New custom practice
                        </Link>
                    }
                />
            </div>

            <Alert tone="info" className="mt-5">
                These sessions are kept separate from My interviews and your progress. Your own questions change from session to
                session, so these scores cannot be compared with the standard interviews.
            </Alert>

            {error && <Alert tone="error" className="mt-3" onClose={() => setError(null)}>{error}</Alert>}

            <div className="mt-6">
                {items.length === 0 && !error ? (
                    <EmptyState
                        icon={ListPlus}
                        title="No custom practice yet"
                        text="Add your own questions and practise them with the same confidence feedback."
                        action={<Link to="/custom-practice" className={btn.primary}>Practise with your own questions <ArrowRight size={16} /></Link>}
                    />
                ) : items.length > 0 && (
                    <Card>
                        <ul className="divide-y divide-slate-100">
                            {items.map((session) => {
                                const done = session.status === 'Completed';
                                const busy = openingId === session.sessionId || deletingId === session.sessionId;
                                const expanded = expandedId === session.sessionId;
                                const preview = session.questions?.[0];
                                return (
                                    <li key={session.sessionId} className="px-5 py-4 sm:px-6">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                            <div className="flex min-w-0 flex-1 items-center gap-4">
                                                <ScoreTile score={session.overallScore} finished={done} />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900">{fmtDateTime(session.createdAt)}</p>
                                                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                                        <span>{session.questionCount} question{session.questionCount === 1 ? '' : 's'}</span>
                                                        <StatusBadge completed={done} />
                                                    </p>
                                                    {preview && !expanded && (
                                                        <p className="mt-1 max-w-xl truncate text-sm text-slate-500">
                                                            “{preview}”{session.questionCount > 1 ? ' …' : ''}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 sm:shrink-0">
                                                {session.questionCount > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedId(expanded ? null : session.sessionId)}
                                                        aria-expanded={expanded}
                                                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                                    >
                                                        Questions <ChevronDown size={15} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                                    </button>
                                                )}
                                                {done && (
                                                    <button type="button" onClick={() => openReport(session.sessionId)} disabled={busy} className={`${btn.secondary} py-2`}>
                                                        {openingId === session.sessionId && <Loader2 size={15} className="animate-spin" />}
                                                        View report
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setToDelete(session)}
                                                    disabled={busy}
                                                    className={`${btn.icon} ml-auto hover:bg-red-50 hover:text-red-600 sm:ml-0`}
                                                    aria-label="Delete practice session"
                                                    title="Delete practice session"
                                                >
                                                    {deletingId === session.sessionId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                        {expanded && (
                                            <ol className="mt-4 list-decimal space-y-1.5 rounded-lg bg-slate-50 py-3 pl-9 pr-4 text-sm text-slate-700">
                                                {session.questions.map((q, i) => <li key={i}>{q}</li>)}
                                            </ol>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </Card>
                )}
            </div>

            <ConfirmDialog
                open={!!toDelete}
                danger
                title="Delete this practice session?"
                message={toDelete?.status === 'Completed'
                    ? "The practice report will be removed. This cannot be undone."
                    : "This practice session was never finished. It will be removed. This cannot be undone."}
                confirmLabel="Delete"
                busy={!!deletingId}
                onConfirm={confirmDelete}
                onCancel={() => setToDelete(null)}
            />
        </div>
    );
};

export default PracticeHistory;