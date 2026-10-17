import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListPlus, Upload, X, ChevronRight, Info, Shuffle, Mic, Camera, AlertTriangle, History } from 'lucide-react';

// ---------------------------------------------------------------------------
// Custom Practice - SUPPORTING FEATURE (not part of the core study).
//
// The student adds their own interview questions (typed/pasted, or from a
// .txt / .csv file) and practises them in the normal voice + camera
// interview. Answers are checked by the AI and the Confidence Score is shown
// at the end, exactly like a standard interview.
//
// Kept separate from the core functions: these sessions are NOT shown in
// My Interviews or the Progress page; they have their own Practice History
// page (see backend custom_practice.py).
//
// Rules (must match backend custom_practice.py): 3-10 questions, each
// 10-300 characters, duplicates removed. Asked in a random order.
// ---------------------------------------------------------------------------

const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 10;
const MIN_CHARS = 10;
const MAX_CHARS = 300;
const DRAFT_KEY = 'customPracticeDraft';

const EXAMPLE = `What is the difference between a class and an object?
Explain how a REST API works.
How do you find and fix a bug in your code?
Describe a project you built and your role in it.`;

// One question per line. Removes list numbering / bullets ("1.", "2)", "-",
// "Q3:") and, for CSV rows, keeps only the first column.
const parseQuestions = (text, isCsv = false) => {
    const seen = new Set();
    const result = [];
    text.split(/\r?\n/).forEach((line) => {
        let q = line;
        if (isCsv) {
            const m = q.match(/^\s*"((?:[^"]|"")*)"/);
            q = m ? m[1].replace(/""/g, '"') : q.split(',')[0];
        }
        q = q.replace(/\s+/g, ' ').trim()
            .replace(/^(?:[-*•]+|\(?\d{1,2}[.)]|q\d{1,2}[:.)])\s*/i, '').trim();
        if (!q || /^questions?$/i.test(q)) return; // empty line or CSV header
        const key = q.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        result.push(q);
    });
    return result;
};

const readDraft = () => {
    try { return localStorage.getItem(DRAFT_KEY) || ''; } catch { return ''; }
};
const saveDraft = (value) => {
    try { localStorage.setItem(DRAFT_KEY, value); } catch { /* storage not available */ }
};

const CustomPractice = () => {
    const navigate = useNavigate();
    const fileRef = useRef(null);
    const [text, setText] = useState(readDraft);
    const [fileError, setFileError] = useState(null);

    useEffect(() => { saveDraft(text); }, [text]);

    const questions = useMemo(() => parseQuestions(text), [text]);
    const tooShort = questions.filter(q => q.length < MIN_CHARS);
    const tooLong = questions.filter(q => q.length > MAX_CHARS);

    let problem = null;
    if (questions.length < MIN_QUESTIONS) problem = `Add at least ${MIN_QUESTIONS} questions (${questions.length} so far).`;
    else if (questions.length > MAX_QUESTIONS) problem = `Use no more than ${MAX_QUESTIONS} questions (you have ${questions.length}).`;
    else if (tooShort.length) problem = `Some questions are too short (at least ${MIN_CHARS} characters each).`;
    else if (tooLong.length) problem = `Some questions are too long (under ${MAX_CHARS} characters each).`;

    const onFile = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setFileError(null);
        if (!/\.(txt|csv)$/i.test(file.name)) {
            setFileError('Please choose a .txt or .csv file.');
            return;
        }
        if (file.size > 100 * 1024) {
            setFileError('That file is too large. Use a small text file with one question per line.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const parsed = parseQuestions(String(reader.result || ''), /\.csv$/i.test(file.name));
            if (!parsed.length) {
                setFileError('No questions were found in that file.');
                return;
            }
            setText(parsed.join('\n'));
        };
        reader.onerror = () => setFileError('The file could not be read.');
        reader.readAsText(file);
    };

    const removeQuestion = (index) => {
        setText(questions.filter((_, i) => i !== index).join('\n'));
    };

    const start = () => {
        if (problem) return;
        // The camera & microphone check starts the session with these questions.
        navigate('/InterviewSetup', { state: { customQuestions: questions } });
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6 max-w-5xl mx-auto">
            {/* Top-right corner: open the list of earlier Custom Practice reports. */}
            <div className="flex justify-end">
                <button
                    onClick={() => navigate('/practice-history')}
                    className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95"
                >
                    <History size={15} className="text-blue-500" /> Practice History
                </button>
            </div>
            <header className="bg-white/80 backdrop-blur-md p-8 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
                        <ListPlus size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Custom Practice</h1>
                        <p className="text-slate-400 font-medium uppercase text-[10px] tracking-widest">Practise with your own questions</p>
                    </div>
                </div>
                <p className="text-sm text-slate-500 font-medium mt-4 leading-relaxed max-w-3xl">
                    Add questions for the IT role you are preparing for. They will be read aloud one by one, you answer by
                    voice, and at the end you get your Confidence Score, confidence feedback and an AI check of your answers.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                    <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full"><Mic size={12} /> Voice answers</span>
                    <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full"><Camera size={12} /> Camera on</span>
                    <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full"><Shuffle size={12} /> Random order</span>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Input */}
                <div className="lg:col-span-3 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Your questions</h2>
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
                        >
                            <Upload size={14} /> Upload .txt / .csv
                        </button>
                        <input ref={fileRef} type="file" accept=".txt,.csv,text/plain,text/csv" className="hidden" onChange={onFile} />
                    </div>
                    <p className="text-xs text-slate-400 font-medium mb-3">One question per line. Numbers and bullets at the start are removed.</p>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={EXAMPLE}
                        rows={12}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700 font-medium leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-y"
                    />
                    {fileError && (
                        <p className="mt-2 text-xs font-semibold text-red-600 flex items-center gap-1.5"><AlertTriangle size={13} /> {fileError}</p>
                    )}
                    {!text.trim() && (
                        <button onClick={() => setText(EXAMPLE)} className="mt-2 text-xs font-bold text-blue-600 hover:underline">
                            Use the example questions
                        </button>
                    )}
                </div>

                {/* Preview + start */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Preview</h2>
                            <span className={`text-[11px] font-black ${questions.length >= MIN_QUESTIONS && questions.length <= MAX_QUESTIONS ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {questions.length} / {MAX_QUESTIONS}
                            </span>
                        </div>
                        {questions.length === 0 ? (
                            <p className="text-sm text-slate-400 font-medium">Your questions will appear here.</p>
                        ) : (
                            <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                {questions.map((q, i) => {
                                    const bad = q.length < MIN_CHARS || q.length > MAX_CHARS || i >= MAX_QUESTIONS;
                                    return (
                                        <li key={`${i}-${q}`} className={`flex items-start gap-2 p-3 rounded-xl border text-sm font-medium ${bad ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-100 bg-slate-50 text-slate-700'}`}>
                                            <span className="text-[10px] font-black text-slate-400 mt-0.5 w-4 shrink-0">{i + 1}</span>
                                            <span className="flex-1 break-words">{q}</span>
                                            <button onClick={() => removeQuestion(i)} className="text-slate-300 hover:text-red-500 shrink-0" aria-label="Remove question">
                                                <X size={15} />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex gap-2 items-start">
                        <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-blue-900/80 font-medium leading-relaxed">
                            {MIN_QUESTIONS}-{MAX_QUESTIONS} questions. They are asked in a random order, so you cannot
                            just read out prepared answers. Practice reports are saved in Practice History, separate
                            from My Interviews and your progress.
                        </p>
                    </div>

                    {problem && questions.length > 0 && (
                        <p className="text-xs font-semibold text-orange-600 flex items-center gap-1.5"><AlertTriangle size={13} /> {problem}</p>
                    )}

                    <button
                        onClick={start}
                        disabled={!!problem}
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${problem
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 shadow-lg shadow-emerald-200'}`}
                    >
                        Continue to camera &amp; mic check <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomPractice;