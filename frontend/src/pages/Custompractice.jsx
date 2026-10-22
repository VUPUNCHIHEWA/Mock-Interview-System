import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, X, ArrowRight, Shuffle, Mic, Camera, History } from 'lucide-react';
import { PageHeader, Card, Alert, btn, inputClass } from '../components/Ui';

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
// UI redesign (Oct 2026): same rules and behaviour, new page style.
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

    const countOk = questions.length >= MIN_QUESTIONS && questions.length <= MAX_QUESTIONS;

    return (
        <div>
            <PageHeader
                eyebrow="Supporting feature"
                title="Custom practice"
                description="Add questions for the IT role you are preparing for. They are read aloud one by one, you answer by voice, and at the end you get your Confidence Score, confidence feedback and an AI check of your answers."
                actions={
                    <Link to="/practice-history" className={btn.secondary}>
                        <History size={16} /> Practice history
                    </Link>
                }
            >
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1"><Mic size={13} /> Voice answers</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1"><Camera size={13} /> Camera on</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1"><Shuffle size={13} /> Random order</span>
                </div>
            </PageHeader>

            <div className="mt-6 grid gap-6 lg:grid-cols-5">
                {/* Input */}
                <Card className="p-5 sm:p-6 lg:col-span-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">Your questions</h2>
                            <p className="mt-0.5 text-sm text-slate-500">One question per line. Numbers and bullets at the start are removed.</p>
                        </div>
                        <button type="button" onClick={() => fileRef.current?.click()} className={`${btn.secondary} py-2`}>
                            <Upload size={15} /> Upload .txt / .csv
                        </button>
                        <input ref={fileRef} type="file" accept=".txt,.csv,text/plain,text/csv" className="hidden" onChange={onFile} />
                    </div>
                    <label htmlFor="cp-questions" className="sr-only">Your questions</label>
                    <textarea
                        id="cp-questions"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={EXAMPLE}
                        rows={12}
                        className={`${inputClass} mt-4 resize-y leading-relaxed`}
                    />
                    {fileError && <Alert tone="error" className="mt-3">{fileError}</Alert>}
                    {!text.trim() && (
                        <button type="button" onClick={() => setText(EXAMPLE)} className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700">
                            Use the example questions
                        </button>
                    )}
                </Card>

                {/* Preview + start */}
                <div className="space-y-4 lg:col-span-2">
                    <Card className="p-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-semibold text-slate-900">Preview</h2>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${countOk ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {questions.length} / {MAX_QUESTIONS}
                            </span>
                        </div>
                        {questions.length === 0 ? (
                            <p className="mt-3 text-sm text-slate-500">Your questions will appear here.</p>
                        ) : (
                            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                                {questions.map((q, i) => {
                                    const bad = q.length < MIN_CHARS || q.length > MAX_CHARS || i >= MAX_QUESTIONS;
                                    return (
                                        <li
                                            key={`${i}-${q}`}
                                            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${bad ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                                        >
                                            <span className="mt-0.5 w-4 shrink-0 text-xs font-medium text-slate-400">{i + 1}</span>
                                            <span className="flex-1 break-words">{q}</span>
                                            <button type="button" onClick={() => removeQuestion(i)} className="shrink-0 rounded p-0.5 text-slate-400 hover:text-red-600" aria-label="Remove question">
                                                <X size={15} />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Card>

                    <Alert tone="info">
                        {MIN_QUESTIONS}–{MAX_QUESTIONS} questions, each {MIN_CHARS}–{MAX_CHARS} characters. They are asked in a random
                        order, so you cannot just read out prepared answers. Reports are saved in Practice history, separate from My
                        interviews and your progress.
                    </Alert>

                    {problem && questions.length > 0 && <Alert tone="warning">{problem}</Alert>}

                    <button type="button" onClick={start} disabled={!!problem} className={`${btn.primary} w-full py-3`}>
                        Continue to camera &amp; mic check <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomPractice;