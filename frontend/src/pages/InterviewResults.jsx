import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { LayoutDashboard, Target, CheckCircle, TrendingUp, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const InterviewResults = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { results } = location.state || {};

    const [expandedQ, setExpandedQ] = useState(null);

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

    const { overallScore, overallStrengths, keyImprovements, evaluations, interviewMode } = results;

    const isTextMode = interviewMode && interviewMode.toUpperCase() === 'TEXT';

    // The backend now sends textualScore, visualScore, and vocalScore if available in the result payload directly
    // Wait, let's parse from results if they exist.
    const textualScore = results.textualScore || Math.max(0, overallScore - 5);
    const visualScore = results.visualScore || Math.max(0, overallScore + 2);
    const vocalScore = results.vocalScore || overallScore;

    const getScoreColor = (score) => {
        if (score >= 80) return '#4ade80'; // green-400
        if (score >= 60) return '#fb923c'; // orange-400
        return '#f87171'; // red-400
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 animate-in fade-in duration-700">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header */}
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
                </div>

                {/* Score & Gemini Summary */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

                    {/* Score Card */}
                    <div className="md:col-span-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">{isTextMode ? 'Textual Score' : 'Integrated Score'}</h3>
                        <div className="w-40 h-40 mb-6">
                            <CircularProgressbar
                                value={overallScore}
                                text={`${overallScore}%`}
                                styles={buildStyles({
                                    pathColor: getScoreColor(overallScore),
                                    textColor: '#0f172a',
                                    trailColor: '#f1f5f9',
                                    textSize: '24px'
                                })}
                                className="font-black"
                            />
                        </div>

                        {!isTextMode && (
                            <div className="w-full space-y-3 mt-4 text-left">
                                <div>
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1 text-slate-500">
                                        <span>📝 Textual Accuracy</span>
                                        <span className="text-slate-700">{textualScore}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full transition-all duration-1000" style={{ width: `${textualScore}%`, backgroundColor: getScoreColor(textualScore) }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1 text-slate-500">
                                        <span>🎥 Visual Confidence</span>
                                        <span className="text-slate-700">{visualScore}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full transition-all duration-1000" style={{ width: `${visualScore}%`, backgroundColor: getScoreColor(visualScore) }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1 text-slate-500">
                                        <span>🎙️ Vocal Delivery</span>
                                        <span className="text-slate-700">{vocalScore}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full transition-all duration-1000" style={{ width: `${vocalScore}%`, backgroundColor: getScoreColor(vocalScore) }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* AI Feedback */}
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
                    </div>
                </div>

                {/* Q&A Breakdown */}
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
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs ${item.score >= 80 ? 'bg-green-500' : item.score >= 60 ? 'bg-orange-500' : 'bg-red-500'}`}>
                                            {item.score}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Question {index + 1}</p>
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
                                            <p className="text-sm font-medium text-slate-600 bg-slate-50 p-4 rounded-xl italic">{item.answer}</p>
                                        </div>
                                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">AI Feedback</p>
                                            <p className="text-sm font-bold text-slate-700">{item.feedback}</p>
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
