import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    ArrowLeft, Video, AlertCircle, ChevronDown, Lightbulb, Eye, Mic, ExternalLink,
    GraduationCap, Clock, RefreshCw, CheckCircle2, TrendingUp, FileText, Ruler, Info, ListPlus,
} from 'lucide-react';

const API = "http://localhost:8000";

// ---------------------------------------------------------------------------
// Results page (UI redesign 2026-10-21).
// Order: Confidence Score (main) -> Visual / Vocal parts with their factors
// -> Answer score (secondary) -> confidence strengths / how to improve ->
// question-by-question breakdown. The data and the "Evaluate now" re-check
// are unchanged. The AI-predicted confidence level badge is not shown
// (ASSUMPTIONS I18, I22).
// ---------------------------------------------------------------------------

const hasValue = (v) => v !== null && v !== undefined && !Number.isNaN(v);

// Same thresholds as before: 80+ strong, 60-79 fair, below 60 weak
const scoreTone = (score) => {
    if (!hasValue(score)) return { bar: 'bg-slate-300', text: 'text-slate-400', soft: 'bg-slate-100 text-slate-600' };
    if (score >= 80) return { bar: 'bg-green-500', text: 'text-green-600', soft: 'bg-green-50 text-green-700' };
    if (score >= 60) return { bar: 'bg-amber-500', text: 'text-amber-600', soft: 'bg-amber-50 text-amber-700' };
    return { bar: 'bg-red-500', text: 'text-red-600', soft: 'bg-red-50 text-red-700' };
};

const fmtNum = (v) => (hasValue(v) ? Math.round(v) : '—');

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------
const Card = ({ className = '', children }) => (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</section>
);

const ScoreRing = ({ value, size = 152 }) => {
    const r = 52;
    const c = 2 * Math.PI * r;
    const v = hasValue(value) ? Math.max(0, Math.min(100, value)) : 0;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
                {hasValue(value) && (
                    <circle
                        cx="60" cy="60" r={r} fill="none" stroke="#2563eb" strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)}
                    />
                )}
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                    <p className="text-4xl font-bold tracking-tight text-slate-900">{fmtNum(value)}</p>
                    <p className="-mt-0.5 text-xs text-slate-500">out of 100</p>
                </div>
            </div>
        </div>
    );
};

const Bar = ({ value, className = 'h-2' }) => (
    <div className={`w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
        {hasValue(value) && (
            <div className={`h-full rounded-full ${scoreTone(value).bar}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
        )}
    </div>
);

// One factor row (Eye Contact, Speech Rate, ...)
const FactorRow = ({ label, score, detail }) => (
    <div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-700">{label}</span>
            <span className={`font-semibold ${scoreTone(score).text}`}>{hasValue(score) ? Math.round(score) : 'N/A'}</span>
        </div>
        <Bar value={score} className="mt-1.5 h-1.5" />
        {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
);

// Visual / Vocal card
const PartCard = ({ icon, title, score, missingText, factors, children }) => {
    const Icon = icon;
    return (
    <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600"><Icon size={16} /></span>
                {title}
            </p>
            <p className="text-2xl font-bold text-slate-900">{hasValue(score) ? Math.round(score) : '—'}</p>
        </div>
        {hasValue(score) ? <Bar value={score} className="mt-3 h-2" /> : <p className="mt-2 text-xs text-slate-500">{missingText}</p>}
        {factors.length > 0 && (
            <div className="mt-4 space-y-3.5 border-t border-slate-100 pt-4">
                {factors.map(f => <FactorRow key={f.label} {...f} />)}
            </div>
        )}
        {children}
    </Card>
    );
};

// One strength / improvement point. Confidence items are objects:
// { factor, group, score, measured, message, tip, priority }.
const FeedbackItem = ({ item, kind }) => {
    if (typeof item === 'string') {
        return <p className="border-l-2 border-slate-200 pl-4 text-sm leading-relaxed text-slate-600">{item}</p>;
    }
    const isStrength = kind === 'strength';
    const GroupIcon = item.group === 'Visual' ? Eye : item.group === 'Vocal' ? Mic : null;
    const frame = item.priority
        ? 'border-amber-300 bg-amber-50/60'
        : isStrength ? 'border-green-200 bg-green-50/40' : 'border-slate-200 bg-white';
    return (
        <div className={`rounded-xl border p-4 ${frame}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    {GroupIcon && <GroupIcon size={15} className="text-slate-400" />}
                    <span className="text-sm font-semibold text-slate-900">{item.factor}</span>
                    {item.group && <span className="text-xs text-slate-500">{item.group}</span>}
                    {item.priority && (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-medium text-white">Top priority</span>
                    )}
                </div>
                {hasValue(item.score) && (
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${scoreTone(item.score).soft}`}>{Math.round(item.score)}</span>
                )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.message}</p>
            {item.measured && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
                    <Ruler size={13} className="mt-0.5 shrink-0" />
                    {item.measured}
                </p>
            )}
            {item.tip && (
                <p className="mt-3 flex gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200">
                    <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-500" />
                    <span>{item.tip}</span>
                </p>
            )}
        </div>
    );
};

const Notice = ({ tone = 'blue', icon = Info, children, action }) => {
    const Icon = icon;
    const tones = {
        blue: 'border-blue-200 bg-blue-50 text-blue-900',
        amber: 'border-amber-200 bg-amber-50 text-amber-900',
        slate: 'border-slate-200 bg-slate-50 text-slate-700',
    };
    return (
        <div className={`flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${tones[tone]}`}>
            <div className="flex gap-2.5">
                <Icon size={16} className="mt-0.5 shrink-0" />
                <div>{children}</div>
            </div>
            {action && <div className="flex shrink-0 gap-2">{action}</div>}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const InterviewResults = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [results, setResults] = useState((location.state || {}).results);
    const [reEvaluating, setReEvaluating] = useState(false);
    const [reEvalError, setReEvalError] = useState(null);
    const [expandedQ, setExpandedQ] = useState(null);

    // "Evaluate now": if the AI service was busy / over its limit, some answers
    // are "Not Evaluated". This asks the backend to check them again (all the
    // saved answers and camera/voice scores are kept) and refreshes the page.
    const reEvaluate = async () => {
        if (!results?.sessionId) return;
        setReEvaluating(true);
        setReEvalError(null);
        try {
            const response = await axios.post(`${API}/api/end-interview`, { sessionId: results.sessionId });
            if (response.data.success) setResults(response.data);
            const stillPending = (response.data.evaluations || []).some(e => e.isNotEvaluated);
            if (stillPending) setReEvalError("The AI service is still busy. Please try again a little later.");
        } catch (err) {
            console.error("Re-evaluation failed:", err);
            setReEvalError("Could not reach the server. Please try again.");
        } finally {
            setReEvaluating(false);
        }
    };

    if (!results) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
                    <AlertCircle size={24} />
                </span>
                <h1 className="mt-4 text-lg font-semibold text-slate-900">No report to show</h1>
                <p className="mt-1 max-w-sm text-sm text-slate-500">Open a report from My interviews, or finish an interview to see a new one.</p>
                <div className="mt-5 flex gap-3">
                    <Link to="/history" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        My interviews
                    </Link>
                    <Link to="/dashboard" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
                        Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const { overallScore, overallStrengths, keyImprovements, evaluations, interviewMode, recommendedResources } = results;

    const sessionRole = results.role;
    const isCustom = sessionRole === 'Custom Practice';
    const sessionDate = results.createdAt || results.date;
    const formattedDate = sessionDate ? new Date(sessionDate).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }) : null;

    const isTextMode = interviewMode && interviewMode.toUpperCase() === 'TEXT';

    const textualScore = results.textualScore;
    const visualScore = results.visualScore;
    const vocalScore = results.vocalScore;
    // Per-factor breakdown (null for older sessions saved before this
    // feature, or when there was no camera / voice data).
    const visualBreakdown = results.visualBreakdown;
    const vocalBreakdown = results.vocalBreakdown;

    const visualFactors = visualBreakdown ? [
        { label: 'Eye contact', score: visualBreakdown.eyeContact, detail: 'Looking at the camera' },
        { label: 'Head position', score: visualBreakdown.headPose, detail: 'Head facing forward and steady' },
    ] : [];

    // New scoring (per minute / % of answer time / PVQ) has a "unit" field;
    // older sessions keep their old wording.
    const isNewVocal = !!(vocalBreakdown?.speechRate?.unit || vocalBreakdown?.fillerWords?.unit);
    // First vocal factor: Speech Rate (SPEECH_RATE_SCORING.md). Sessions saved
    // before 2026-10-16 have Filler Words instead and keep their old wording.
    const sr = vocalBreakdown?.speechRate;
    const fw = vocalBreakdown?.fillerWords;
    const firstVocalFactor = sr
        ? {
            label: 'Speech rate', score: sr.score,
            detail: sr.enoughSpeech === false
                ? `Not enough speech to score (${sr.speakingSeconds} s of speaking, needs ${sr.minSpeakingSeconds} s).`
                : hasValue(sr.value) ? `${sr.value} words per minute · ${sr.label}: ${sr.labelText}` : null,
        }
        : {
            label: 'Filler words (older scoring)', score: fw?.score,
            detail: !hasValue(fw?.value) ? null : fw.unit
                ? `${fw.value} per minute (100 at ${fw.fullMarksAtOrBelow} or fewer, 0 at ${fw.zeroAtOrAbove} or more)`
                : `Avg ${fw.value} per answer (older scoring)`,
        };
    const vocalFactors = vocalBreakdown ? [
        firstVocalFactor,
        {
            label: 'Long pauses', score: vocalBreakdown.longPauses?.score,
            detail: !hasValue(vocalBreakdown.longPauses?.value) ? null : isNewVocal
                ? `${vocalBreakdown.longPauses.value}% of answer time in pauses of ${vocalBreakdown.longPauses.minPauseSeconds}s or longer`
                : `Avg ${vocalBreakdown.longPauses.value} long pauses per answer (older scoring)`,
        },
        {
            // Pitch Variation (PITCH_VARIATION_SCORING.md): 0 at PVQ 0.06 or less,
            // 100 at 0.15 or more (Hincks, 2005). Label: Low (< 15%) / Good.
            label: 'Pitch variation', score: vocalBreakdown.pitchVariation?.score,
            detail: !hasValue(vocalBreakdown.pitchVariation?.value) ? null : isNewVocal
                ? `Variation ${Math.round(vocalBreakdown.pitchVariation.value * 100)}% of your average pitch${vocalBreakdown.pitchVariation.label ? ` · ${vocalBreakdown.pitchVariation.label}` : ''} (100 at ${Math.round(vocalBreakdown.pitchVariation.fullMarksAtOrAbove * 100)}% or more)`
                : `${vocalBreakdown.pitchVariation.value} Hz (older scoring)`,
        },
    ] : [];

    // Confidence feedback (voice/camera interviews): each item is an object
    // built from the measured factors (confidence_feedback.py). Older or
    // text-only sessions may still have plain strings - both are shown.
    const toList = (v) => Array.isArray(v) ? v : (v ? [v] : []);
    const strengthItems = toList(overallStrengths);
    const improvementItems = toList(keyImprovements);
    const isOldFeedbackFormat = !isTextMode && [...strengthItems, ...improvementItems].some(i => typeof i === 'string');

    const noFeedbackText = isTextMode
        ? 'No feedback available.'
        : 'No camera or voice measurements were recorded, so confidence feedback cannot be given.';

    const evalList = evaluations || [];
    const notEvaluatedCount = evalList.filter(e => e.isNotEvaluated).length;

    return (
        <div>
            {/* Header */}
            <Link
                to={isCustom ? '/practice-history' : '/history'}
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-800"
            >
                <ArrowLeft size={16} />
                {isCustom ? 'Practice history' : 'My interviews'}
            </Link>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        {isTextMode ? 'Performance report' : 'Confidence report'}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {isTextMode
                            ? 'A breakdown of your answers in this mock interview.'
                            : 'How confident you came across on camera and in your voice, and what to work on next.'}
                    </p>
                    {(sessionRole || formattedDate) && (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            {sessionRole && <span className="rounded-full bg-slate-900 px-2.5 py-1 font-medium text-white">{sessionRole}</span>}
                            {results.difficulty && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{results.difficulty}</span>}
                            {formattedDate && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{formattedDate}</span>}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => navigate(isCustom ? '/custom-practice' : '/InterviewSetup')}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                    {isCustom ? <ListPlus size={16} /> : <Video size={16} />}
                    {isCustom ? 'Practise again' : 'New interview'}
                </button>
            </div>

            {/* Notices */}
            <div className="mt-5 space-y-3">
                {isCustom && (
                    <Notice icon={ListPlus}>
                        Custom practice with your own questions. This report is saved in Practice history, separate from
                        My interviews and your progress.
                    </Notice>
                )}

                {notEvaluatedCount > 0 && (
                    <Notice
                        tone="amber"
                        icon={Clock}
                        action={results.sessionId && (
                            <button
                                type="button"
                                onClick={reEvaluate}
                                disabled={reEvaluating}
                                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
                            >
                                <RefreshCw size={15} className={reEvaluating ? 'animate-spin' : ''} />
                                {reEvaluating ? 'Checking...' : 'Evaluate now'}
                            </button>
                        )}
                    >
                        {notEvaluatedCount} answer{notEvaluatedCount > 1 ? 's' : ''} could not be checked yet because the AI
                        service was busy. Your answers and camera/voice scores are saved, and your Confidence Score is already
                        final (it does not depend on this check).
                        {reEvalError && <span className="mt-1 block font-medium text-red-600">{reEvalError}</span>}
                    </Notice>
                )}

                {results.replacedQuestions > 0 && (
                    <Notice tone="slate" icon={RefreshCw}>
                        {results.replacedQuestions} question{results.replacedQuestions > 1 ? 's were' : ' was'} replaced because
                        your face was not detected for 30 seconds.
                    </Notice>
                )}
            </div>

            {/* Scores */}
            {isTextMode ? (
                <Card className="mt-6 flex flex-col items-center gap-6 p-6 sm:flex-row">
                    <ScoreRing value={overallScore} />
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Answer score</p>
                        <p className="mt-1 text-sm text-slate-500">Content of your answers, checked by AI.</p>
                    </div>
                </Card>
            ) : (
                <div className="mt-6 grid gap-5 lg:grid-cols-3">
                    {/* Confidence score (main) */}
                    <Card className="flex flex-col items-center p-6 text-center">
                        <p className="text-sm font-semibold text-slate-900">Confidence score</p>
                        <div className="mt-4">
                            <ScoreRing value={overallScore} />
                        </div>
                        <p className="mt-4 text-xs text-slate-500">Average of visual and vocal confidence (both are needed).</p>
                        {!hasValue(overallScore) && results.confidenceMissingReason && (
                            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{results.confidenceMissingReason}</p>
                        )}
                        {hasValue(results.legacyOverallScore) && (
                            <p className="mt-2 text-xs text-slate-500">
                                Older interview: scored with the previous formula (60% answers + 20% camera + 20% voice) ={' '}
                                {results.legacyOverallScore}. Not comparable with the Confidence Score.
                            </p>
                        )}

                        {/* Answer score: secondary, NOT part of the Confidence Score */}
                        <div className="mt-5 w-full border-t border-slate-100 pt-4 text-left">
                            <div className="flex items-baseline justify-between text-sm">
                                <span className="flex items-center gap-1.5 text-slate-700"><FileText size={14} className="text-slate-400" /> Answer score</span>
                                <span className="font-semibold text-slate-700">
                                    {hasValue(textualScore) ? Math.round(textualScore) : notEvaluatedCount > 0 ? 'Pending' : 'N/A'}
                                </span>
                            </div>
                            <Bar value={textualScore} className="mt-1.5 h-1.5" />
                            <p className="mt-1 text-xs text-slate-500">Content of your answers, checked by AI. Not part of the Confidence Score.</p>
                        </div>
                    </Card>

                    <PartCard icon={Eye} title="Visual confidence" score={visualScore} missingText="No camera data recorded." factors={visualFactors}>
                        {hasValue(visualBreakdown?.faceNotVisiblePct) && visualBreakdown.faceNotVisiblePct > 0 && (
                            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                Face not visible for {Math.round(visualBreakdown.faceNotVisiblePct)}% of the measured time (counted as 0).
                            </p>
                        )}
                    </PartCard>

                    <PartCard icon={Mic} title="Vocal confidence" score={vocalScore} missingText="No voice data recorded." factors={vocalFactors} />
                </div>
            )}

            {/* Feedback */}
            {isOldFeedbackFormat && (
                <div className="mt-6">
                    <Notice tone="slate">
                        Older report format: the points below were written by AI before confidence-only feedback was added, so they
                        may also talk about your answers.
                    </Notice>
                </div>
            )}

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <Card className="p-6">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                        <TrendingUp size={18} className="text-amber-500" />
                        {isTextMode ? 'Areas to improve' : 'How to build more confidence'}
                    </h2>
                    {!isTextMode && (
                        <p className="mt-1 text-sm text-slate-500">Weakest factor first. Each point shows what was measured and one thing to try next time.</p>
                    )}
                    <div className="mt-4 space-y-3">
                        {improvementItems.length > 0
                            ? improvementItems.map((item, i) => <FeedbackItem key={i} item={item} kind="improvement" />)
                            : <p className="text-sm text-slate-500">{noFeedbackText}</p>}
                    </div>
                </Card>

                <Card className="p-6">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                        <CheckCircle2 size={18} className="text-green-600" />
                        {isTextMode ? 'Strengths' : 'Confidence strengths'}
                    </h2>
                    {!isTextMode && (
                        <p className="mt-1 text-sm text-slate-500">Confidence factors that reached the strong level (80 or above).</p>
                    )}
                    <div className="mt-4 space-y-3">
                        {strengthItems.length > 0
                            ? strengthItems.map((item, i) => <FeedbackItem key={i} item={item} kind="strength" />)
                            : <p className="text-sm text-slate-500">{noFeedbackText}</p>}
                    </div>
                </Card>
            </div>

            {/* Career guidance (supporting feature) - only when triggered */}
            {recommendedResources && recommendedResources.triggered && (
                <Card className="mt-6 p-6">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                        <GraduationCap size={18} className="text-blue-600" />
                        Recommended learning resources
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{recommendedResources.reason}</p>
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                        {recommendedResources.resources.map((res, i) => (
                            <li key={i}>
                                <a
                                    href={res.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-blue-300"
                                >
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">{res.name}</p>
                                        <p className="text-xs text-slate-500">{res.type}</p>
                                    </div>
                                    <ExternalLink size={15} className="shrink-0 text-slate-300 group-hover:text-blue-600" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            {/* Question breakdown */}
            <Card className="mt-6">
                <div className="border-b border-slate-100 px-6 py-4">
                    <h2 className="text-base font-semibold text-slate-900">Question breakdown</h2>
                    <p className="mt-0.5 text-sm text-slate-500">Your answer to each question, with AI feedback on the content.</p>
                </div>
                {evalList.length > 0 ? (
                    <ul className="divide-y divide-slate-100">
                        {evalList.map((item, index) => {
                            const open = expandedQ === index;
                            const badge = item.isSkipped
                                ? { text: 'Skip', cls: 'bg-slate-100 text-slate-500' }
                                : item.isNotEvaluated
                                    ? { text: 'N/A', cls: 'bg-slate-100 text-slate-500' }
                                    : { text: fmtNum(item.score), cls: scoreTone(item.score).soft };
                            return (
                                <li key={index}>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedQ(open ? null : index)}
                                        aria-expanded={open}
                                        className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-slate-50"
                                    >
                                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-semibold ${badge.cls}`}>{badge.text}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-slate-500">
                                                Question {index + 1}
                                                {item.isSkipped && ' · Skipped'}
                                                {item.isNotEvaluated && ' · Not evaluated'}
                                            </p>
                                            <p className={`text-sm font-medium text-slate-800 ${open ? '' : 'line-clamp-1'}`}>{item.question}</p>
                                        </div>
                                        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                                    </button>

                                    {open && (
                                        <div className="space-y-4 px-6 pb-6 sm:pl-20">
                                            <div>
                                                <p className="text-xs font-medium text-slate-500">Your answer</p>
                                                <p className="mt-1 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                                                    {item.isSkipped ? 'You skipped this question.' : (item.answer || '—')}
                                                </p>
                                                {hasValue(item.speechRate) && (
                                                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                                                        <Mic size={13} />
                                                        Speaking speed: {item.speechRate} words per minute
                                                        {hasValue(item.answerSeconds) ? ` (${Math.round(item.answerSeconds)} s answer)` : ''}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3">
                                                <p className="text-xs font-medium text-blue-700">
                                                    {isTextMode ? 'AI feedback' : 'Answer feedback (content only - not part of the Confidence Score)'}
                                                </p>
                                                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                                                    {item.isSkipped
                                                        ? 'This question was skipped and was not included in your score.'
                                                        : item.isNotEvaluated
                                                            ? 'This answer could not be evaluated (AI service limit reached) and was not included in your score.'
                                                            : item.feedback}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="px-6 py-5 text-sm text-slate-500">No evaluation data available.</p>
                )}
            </Card>
        </div>
    );
};

export default InterviewResults;