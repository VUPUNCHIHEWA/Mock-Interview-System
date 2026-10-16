import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { LayoutDashboard, Target, CheckCircle, TrendingUp, AlertCircle, ChevronDown, ChevronUp, GraduationCap, ExternalLink, ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';

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
            const response = await axios.post("http://localhost:8000/api/end-interview", { sessionId: results.sessionId });
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
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
                <AlertCircle size={48} className="text-slate-400 mb-4" />
                <h2 className="text-xl font-bold text-slate-700">No results found.</h2>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-500"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    const { overallScore, overallStrengths, keyImprovements, evaluations, interviewMode, confidenceLevel, recommendedResources } = results;

    // --- BSc Research Feature (Suggestion #2/#4): session context
    // (role/difficulty/date) - shown in the header for quick reference
    // when revisiting a report later (e.g. from History).
    const sessionRole = results.role;
    const sessionDifficulty = results.difficulty;
    const sessionDate = results.createdAt || results.date;
    const formattedDate = sessionDate ? new Date(sessionDate).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : null;

    const isTextMode = interviewMode && interviewMode.toUpperCase() === 'TEXT';

    const textualScore = results.textualScore;
    const visualScore = results.visualScore;
    const vocalScore = results.vocalScore;
    // Per-factor breakdown (null for older sessions saved before this
    // feature, or when there was no camera / voice data).
    const visualBreakdown = results.visualBreakdown;
    const vocalBreakdown = results.vocalBreakdown;

    const hasValue = (v) => v !== null && v !== undefined;

    // Sub-factor rows shown under Visual Confidence and Vocal Delivery.
    const visualFactors = visualBreakdown ? [
        { label: 'Eye Contact', score: visualBreakdown.eyeContact, detail: 'Looking at the camera' },
        { label: 'Head Pose', score: visualBreakdown.headPose, detail: 'Head facing forward and steady' },
    ] : [];
    // New scoring (per minute / % of answer time / PVQ) has a "unit" field;
    // older sessions keep their old wording.
    const isNewVocal = !!vocalBreakdown?.fillerWords?.unit;
    const vocalFactors = vocalBreakdown ? [
        {
            label: 'Filler Words', score: vocalBreakdown.fillerWords?.score,
            detail: !hasValue(vocalBreakdown.fillerWords?.value) ? null : isNewVocal
                ? `${vocalBreakdown.fillerWords.value} per minute (100% at ${vocalBreakdown.fillerWords.fullMarksAtOrBelow} or fewer, 0% at ${vocalBreakdown.fillerWords.zeroAtOrAbove} or more)`
                : `Avg ${vocalBreakdown.fillerWords.value} per answer (older scoring)`
        },
        {
            label: 'Long Pauses', score: vocalBreakdown.longPauses?.score,
            detail: !hasValue(vocalBreakdown.longPauses?.value) ? null : isNewVocal
                ? `${vocalBreakdown.longPauses.value}% of answer time in pauses of ${vocalBreakdown.longPauses.minPauseSeconds}s or longer`
                : `Avg ${vocalBreakdown.longPauses.value} long pauses per answer (older scoring)`
        },
        {
            label: 'Pitch Variation', score: vocalBreakdown.pitchVariation?.score,
            detail: !hasValue(vocalBreakdown.pitchVariation?.value) ? null : isNewVocal
                ? `Variation ${Math.round(vocalBreakdown.pitchVariation.value * 100)}% of your average pitch (100% at ${Math.round(vocalBreakdown.pitchVariation.fullMarksAtOrAbove * 100)}% or more)`
                : `${vocalBreakdown.pitchVariation.value} Hz (older scoring)`
        },
    ] : [];

    // The weakest factor (below 80%) - shown as a direct "focus on this" tip.
    const weakestFactor = [...visualFactors, ...vocalFactors]
        .filter(f => hasValue(f.score) && f.score < 80)
        .sort((a, b) => a.score - b.score)[0];

    const getScoreColor = (score) => {
        if (score >= 80) return '#4ade80';
        if (score >= 60) return '#fb923c';
        return '#f87171';
    };

    const FactorBar = ({ label, score, detail }) => (
        <div className="pl-3 border-l-2 border-slate-100">
            <div className="flex justify-between text-[10px] font-semibold mb-1 text-slate-400">
                <span>{label}</span>
                <span className="text-slate-600 font-bold">{hasValue(score) ? `${Math.round(score)}%` : 'N/A'}</span>
            </div>
            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-1000" style={{ width: `${score ?? 0}%`, backgroundColor: getScoreColor(score ?? 0) }}></div>
            </div>
            {detail && <p className="text-[9px] text-slate-400 mt-0.5">{detail}</p>}
        </div>
    );

    const getConfidenceBadgeStyle = (level) => {
        if (level === 'High Confidence') {
            return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: '🟢' };
        }
        if (level === 'Moderate Confidence') {
            return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: '🟠' };
        }
        if (level === 'Low Confidence') {
            return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: '🔴' };
        }
        return { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', icon: '⚪' };
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 animate-in fade-in duration-700">
            <div className="max-w-5xl mx-auto space-y-8">

                <div className="flex justify-between items-center">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="group flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-all font-bold text-[10px] uppercase tracking-[0.2em]"
                    >
                        <LayoutDashboard size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                    </button>
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm flex items-center gap-2">
                        <Target size={14} className="text-blue-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Interview Summary</span>
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Performance Report</h1>
                    <p className="text-slate-500 mt-2 font-medium">Detailed breakdown of your technical mock interview.</p>
                    {/* Suggestion #2/#4: role/difficulty/date context */}
                    {(sessionRole || sessionDifficulty || formattedDate) && (
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                            {sessionRole && (
                                <span className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">{sessionRole}</span>
                            )}
                            {sessionDifficulty && (
                                <span className="bg-orange-100 text-orange-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">{sessionDifficulty}</span>
                            )}
                            {formattedDate && (
                                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-3 py-1.5 rounded-full">{formattedDate}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Some answers could not be checked (AI service busy / over its limit). */}
                {(evaluations || []).some(e => e.isNotEvaluated) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
                        <p className="text-xs font-semibold text-amber-800">
                            ⏳ {(evaluations || []).filter(e => e.isNotEvaluated).length} answer(s) could not be checked yet because the AI service was busy.
                            Your answers and camera/voice scores are saved, and your Confidence Score is already final (it does not depend on this check).
                            {reEvalError && <span className="block mt-1 text-red-600">{reEvalError}</span>}
                        </p>
                        {results.sessionId && (
                            <button
                                onClick={reEvaluate}
                                disabled={reEvaluating}
                                className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-60"
                            >
                                {reEvaluating ? 'Checking...' : 'Evaluate now'}
                            </button>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

                    <div className="md:col-span-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">{isTextMode ? 'Textual Score' : 'Confidence Score'}</h3>
                        <div className="w-40 h-40 mb-6">
                            <CircularProgressbar
                                value={overallScore ?? 0}
                                text={overallScore !== null && overallScore !== undefined ? `${overallScore}%` : '—'}
                                styles={buildStyles({
                                    pathColor: getScoreColor(overallScore ?? 0),
                                    textColor: '#0f172a',
                                    trailColor: '#f1f5f9',
                                    textSize: '24px'
                                })}
                                className="font-black"
                            />
                        </div>

                        {!isTextMode && hasValue(results.legacyOverallScore) && (
                            <p className="text-[10px] text-slate-400 font-medium -mt-2 mb-2">
                                Older interview: scored with the previous formula (60% answers + 20% camera + 20% voice) = {results.legacyOverallScore}%. Not comparable with the Confidence Score.
                            </p>
                        )}
                        {!isTextMode && (
                            <p className="text-[10px] text-slate-400 font-medium -mt-2 mb-2">
                                Average of Visual Confidence and Vocal Delivery (both are needed).
                            </p>
                        )}
                        {!isTextMode && !hasValue(overallScore) && results.confidenceMissingReason && (
                            <p className="text-[10px] text-amber-600 font-semibold mb-2">
                                {results.confidenceMissingReason}
                            </p>
                        )}

                        {!isTextMode && (
                            <div className="w-full space-y-3 mt-4 text-left">
                                <div>
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1 text-slate-500">
                                        <span>🎥 Visual Confidence</span>
                                        <span className="text-slate-700">{visualScore !== null && visualScore !== undefined ? `${visualScore}%` : 'N/A - no camera data'}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full transition-all duration-1000" style={{ width: `${visualScore ?? 0}%`, backgroundColor: getScoreColor(visualScore ?? 0) }}></div>
                                    </div>
                                    {visualFactors.length > 0 && (
                                        <div className="mt-2 space-y-2">
                                            {visualFactors.map(f => <FactorBar key={f.label} {...f} />)}
                                            {hasValue(visualBreakdown?.faceNotVisiblePct) && visualBreakdown.faceNotVisiblePct > 0 && (
                                                <p className="pl-3 text-[9px] font-semibold text-orange-500">
                                                    ⚠️ Face not visible for {Math.round(visualBreakdown.faceNotVisiblePct)}% of the measured time (counted as 0).
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1 text-slate-500">
                                        <span>🎙️ Vocal Delivery</span>
                                        <span className="text-slate-700">{vocalScore !== null && vocalScore !== undefined ? `${vocalScore}%` : 'N/A - no voice data'}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full transition-all duration-1000" style={{ width: `${vocalScore ?? 0}%`, backgroundColor: getScoreColor(vocalScore ?? 0) }}></div>
                                    </div>
                                    {vocalFactors.length > 0 && (
                                        <div className="mt-2 space-y-2">
                                            {vocalFactors.map(f => <FactorBar key={f.label} {...f} />)}
                                        </div>
                                    )}
                                </div>

                                {results.replacedQuestions > 0 && (
                                    <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-[10px] text-amber-700 font-semibold">
                                        🔁 {results.replacedQuestions} question{results.replacedQuestions > 1 ? 's were' : ' was'} replaced because your face was not detected for 30 seconds.
                                    </div>
                                )}

                                {weakestFactor && (
                                    <div className="mt-3 p-2.5 rounded-xl bg-red-50 border border-red-100 text-[10px] text-red-700 font-semibold">
                                        🎯 Focus on improving: <span className="font-black">{weakestFactor.label}</span> ({Math.round(weakestFactor.score)}%)
                                    </div>
                                )}

                                {/* Answer score: shown separately - NOT part of the Confidence Score. */}
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1 text-slate-500">
                                        <span>📝 Answer Score</span>
                                        <span className="text-slate-700">{hasValue(textualScore) ? `${textualScore}%` : (evaluations || []).some(e => e.isNotEvaluated) ? 'Pending' : 'N/A'}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full transition-all duration-1000" style={{ width: `${textualScore ?? 0}%`, backgroundColor: getScoreColor(textualScore ?? 0) }}></div>
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-0.5">Content of your answers, checked by AI. Shown separately - not part of the Confidence Score.</p>
                                </div>

                                {confidenceLevel && confidenceLevel !== 'NOT_AVAILABLE' && (
                                    <div className={`mt-4 p-3 rounded-xl border ${getConfidenceBadgeStyle(confidenceLevel).bg} ${getConfidenceBadgeStyle(confidenceLevel).border}`}>
                                        <div className="flex items-center justify-center gap-2">
                                            <span>{getConfidenceBadgeStyle(confidenceLevel).icon}</span>
                                            <span className={`text-[11px] font-black uppercase tracking-widest ${getConfidenceBadgeStyle(confidenceLevel).text}`}>
                                                AI-Predicted Confidence: {confidenceLevel}
                                            </span>
                                        </div>
                                        {/* Suggestion #3: brief explanation to avoid ambiguity about what this measures */}
                                        <p className="text-[9px] text-slate-400 font-medium mt-1.5 text-center leading-relaxed">
                                            Based only on your eye contact, head stability, and voice delivery patterns - not on the correctness of your answers.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="md:col-span-8 space-y-6">
                        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <CheckCircle className="text-green-500" size={24} />
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Overall Strengths</h3>
                            </div>
                            <ul className="list-disc pl-5 text-slate-600 leading-relaxed font-medium space-y-2">
                                {Array.isArray(overallStrengths)
                                    ? overallStrengths.map((str, i) => <li key={i}>{str}</li>)
                                    : <li>{overallStrengths}</li>}
                            </ul>
                        </div>

                        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <TrendingUp className="text-orange-500" size={24} />
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Key Areas for Improvement</h3>
                            </div>
                            <ul className="list-disc pl-5 text-slate-600 leading-relaxed font-medium space-y-2">
                                {Array.isArray(keyImprovements)
                                    ? keyImprovements.map((str, i) => <li key={i}>{str}</li>)
                                    : <li>{keyImprovements}</li>}
                            </ul>
                        </div>

                        {/* --- BSc Research Feature: Career Guidance Suggestions
                            (Supporting Feature, NOT a core research contribution).
                            Only shown when the content/textual score indicates a
                            genuine knowledge gap - see career_resources.py for
                            full scope disclosure. */}
                        {recommendedResources && recommendedResources.triggered && (
                            <div className="bg-indigo-50/60 p-8 rounded-[2rem] border border-indigo-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <GraduationCap className="text-indigo-500" size={24} />
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Recommended Learning Resources</h3>
                                </div>
                                <p className="text-xs text-indigo-800/80 font-medium mb-4">{recommendedResources.reason}</p>
                                <ul className="space-y-2">
                                    {recommendedResources.resources.map((res, i) => (
                                        <li key={i}>
                                            <a
                                                href={res.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between bg-white p-3 rounded-xl border border-indigo-100 hover:border-indigo-300 transition-colors group"
                                            >
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">{res.name}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{res.type}</p>
                                                </div>
                                                <ExternalLink size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                                            </a>
                                        </li>
                                    ))}
                                </ul>

                                {/* --- BSc Research Feature: Practice Quiz link -
                                    only shown for QA Engineer, matching the
                                    currently-authored quiz content (see
                                    istqb_quiz.py). Extending to other roles
                                    would require authoring role-specific
                                    question sets first. */}
                                {sessionRole === 'QA Engineer' && (
                                    <button
                                        onClick={() => navigate('/istqb-quiz')}
                                        className="w-full mt-4 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                                    >
                                        <ClipboardCheck size={16} /> Practice Quiz — Test Your Knowledge
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm mt-8">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-800 mb-6 flex items-center gap-3">
                        <span className="bg-slate-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px]">Q</span>
                        Question Breakdown
                    </h3>

                    <div className="space-y-4">
                        {evaluations && evaluations.length > 0 ? evaluations.map((item, index) => (
                            <div key={index} className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm transition-all">
                                <button
                                    onClick={() => setExpandedQ(expandedQ === index ? null : index)}
                                    className="w-full bg-slate-50 p-5 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Suggestion #1 (Critical): distinct badge for skipped/not-evaluated
                                            questions instead of a numeric score badge, and instead of the
                                            question disappearing from the breakdown entirely. */}
                                        {item.isSkipped ? (
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-[9px] uppercase bg-slate-400 text-center leading-tight">
                                                Skip
                                            </div>
                                        ) : item.isNotEvaluated ? (
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-[8px] uppercase bg-slate-500 text-center leading-tight">
                                                N/A
                                            </div>
                                        ) : (
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs ${item.score >= 80 ? 'bg-green-500' : item.score >= 60 ? 'bg-orange-500' : 'bg-red-500'}`}>
                                                {item.score}
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                                Question {index + 1}
                                                {item.isSkipped && <span className="text-slate-400 normal-case"> · Skipped</span>}
                                                {item.isNotEvaluated && <span className="text-slate-400 normal-case"> · Not Evaluated</span>}
                                            </p>
                                            <p className="text-sm font-bold text-slate-700 line-clamp-1">{item.question}</p>
                                        </div>
                                    </div>
                                    {expandedQ === index ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                                </button>

                                {expandedQ === index && (
                                    <div className="p-6 bg-white border-t border-slate-100 space-y-6">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Question</p>
                                            <p className="text-sm font-medium text-slate-800 bg-slate-50 p-4 rounded-xl">{item.question}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Your Answer</p>
                                            <p className="text-sm font-medium text-slate-600 bg-slate-50 p-4 rounded-xl italic">
                                                {item.isSkipped ? 'You skipped this question.' : item.answer}
                                            </p>
                                        </div>
                                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">AI Feedback</p>
                                            <p className="text-sm font-bold text-slate-700">
                                                {item.isSkipped
                                                    ? 'This question was skipped and was not included in your score.'
                                                    : item.isNotEvaluated
                                                        ? 'This answer could not be evaluated (AI service limit reached) and was not included in your score.'
                                                        : item.feedback}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )) : (
                            <p className="text-slate-500 text-sm">No evaluation data available.</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default InterviewResults;