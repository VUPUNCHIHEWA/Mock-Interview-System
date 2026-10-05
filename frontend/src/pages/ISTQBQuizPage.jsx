import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LayoutDashboard, Loader2, CheckCircle2, XCircle, GraduationCap, RotateCcw } from 'lucide-react';

// --- BSc Research Feature: QA Career-Prep Practice Quiz (Supporting
// Feature, extension of Career Guidance Suggestions - see
// istqb_quiz.py for full scope/copyright disclosure). Original MCQ
// questions covering ISTQB Foundation syllabus topic areas.
const ISTQBQuizPage = () => {
    const navigate = useNavigate();
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState({}); // { questionId: selectedIndex }
    const [submitted, setSubmitted] = useState(false);
    const [results, setResults] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        axios.get("http://localhost:8000/api/istqb-quiz")
            .then(response => {
                setQuestions(response.data.questions || []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load quiz:", err);
                setLoading(false);
            });
    }, []);

    const handleSelect = (questionId, optionIndex) => {
        if (submitted) return;
        setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const response = await axios.post("http://localhost:8000/api/istqb-quiz/submit", { answers });
            setResults(response.data);
            setSubmitted(true);
        } catch (err) {
            console.error("Failed to submit quiz:", err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRetry = () => {
        setAnswers({});
        setSubmitted(false);
        setResults(null);
    };

    const allAnswered = questions.length > 0 && questions.every(q => answers[q.id] !== undefined);

    const getResultForQuestion = (questionId) => {
        if (!results) return null;
        return results.results.find(r => r.id === questionId);
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 animate-in fade-in duration-700">
            <div className="max-w-3xl mx-auto space-y-8">

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
                    <GraduationCap className="mx-auto text-indigo-500 mb-3" size={40} />
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">QA Practice Quiz</h1>
                    <p className="text-slate-500 mt-2 font-medium">Test your knowledge of core software testing concepts.</p>
                </div>

                {loading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
                        <p className="text-slate-500 font-medium">Loading quiz...</p>
                    </div>
                )}

                {!loading && submitted && results && (
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-[2rem] p-8 shadow-xl shadow-indigo-200 text-white text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 mb-2">Your Score</p>
                        <h2 className="text-5xl font-black mb-2">{results.score} / {results.total}</h2>
                        <p className="text-sm font-medium opacity-90">
                            {results.score === results.total
                                ? "Perfect score! Great grasp of the fundamentals."
                                : "Review the explanations below for questions you missed."}
                        </p>
                    </div>
                )}

                {!loading && questions.length === 0 && (
                    <div className="bg-white border border-slate-100 rounded-[2rem] p-10 shadow-sm text-center">
                        <p className="text-slate-500 font-medium">Quiz questions could not be loaded. Please try again later.</p>
                    </div>
                )}

                {!loading && questions.length > 0 && (
                    <div className="space-y-4">
                        {questions.map((q, index) => {
                            const result = getResultForQuestion(q.id);
                            return (
                                <div key={q.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Question {index + 1}</p>
                                    <p className="text-sm font-bold text-slate-800 mb-4">{q.question}</p>
                                    <div className="space-y-2">
                                        {q.options.map((option, optIndex) => {
                                            const isSelected = answers[q.id] === optIndex;
                                            let optionStyle = "border-slate-200 hover:border-indigo-300";
                                            if (submitted && result) {
                                                if (optIndex === result.correct_index) {
                                                    optionStyle = "border-green-400 bg-green-50";
                                                } else if (isSelected && !result.correct) {
                                                    optionStyle = "border-red-400 bg-red-50";
                                                }
                                            } else if (isSelected) {
                                                optionStyle = "border-indigo-500 bg-indigo-50";
                                            }
                                            return (
                                                <button
                                                    key={optIndex}
                                                    onClick={() => handleSelect(q.id, optIndex)}
                                                    disabled={submitted}
                                                    className={`w-full text-left p-3 rounded-xl border-2 text-sm font-medium text-slate-700 transition-all ${optionStyle} disabled:cursor-default`}
                                                >
                                                    {option}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {submitted && result && (
                                        <div className={`mt-4 p-3 rounded-xl flex gap-2 items-start ${result.correct ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                                            {result.correct
                                                ? <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16} />
                                                : <XCircle className="text-red-500 shrink-0 mt-0.5" size={16} />}
                                            <p className="text-xs text-slate-600 font-medium">{result.explanation}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {!submitted ? (
                            <button
                                onClick={handleSubmit}
                                disabled={!allAnswered || submitting}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 disabled:bg-slate-300 disabled:text-slate-500 flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
                                {allAnswered ? "Submit Answers" : "Answer All Questions to Submit"}
                            </button>
                        ) : (
                            <button
                                onClick={handleRetry}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <RotateCcw size={16} /> Try Again
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ISTQBQuizPage;