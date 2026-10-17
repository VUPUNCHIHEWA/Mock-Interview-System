import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { LayoutDashboard, Loader2, AlertCircle, Rocket, Calendar, ChevronRight, SlidersHorizontal } from 'lucide-react';

// ---------------------------------------------------------------------------
// ⭐ Progress page (BSc Research Feature - longitudinal progress tracking)
//
// TOP:    a time chart of the student's scores (X = interview date/time,
//         Y = score %), with time ranges 24h / 7d / 30d / 90d / 1y / All.
//         One filter: FACTOR (overall score or one of the 5 confidence
//         factors). (Interviews no longer have a job role or level.)
//         The dashed line is the BASELINE = the first score in the selected
//         time range. Parts of the line above it are green (improved), parts
//         below it are red (dropped). The badge shows the % change from the
//         first to the latest score in the range.
// BELOW:  one card per interview (newest first) with its overall score and
//         the score of each of the 5 factors.
//
// Data: GET /api/progress-timeline/{userId} (see progress_tracker.py).
// ---------------------------------------------------------------------------

const API = "http://localhost:8000";

const UP_COLOR = '#12b076';    // above baseline (validated vs dark surface)
const DOWN_COLOR = '#ea3943';  // below baseline
const BASE_COLOR = '#94a3b8';

const FACTORS = [
    { key: 'overall', label: 'Confidence Score', group: null },
    { key: 'eyeContact', label: 'Eye Contact', group: 'Visual' },
    { key: 'headPose', label: 'Head Pose', group: 'Visual' },
    { key: 'speechRate', label: 'Speech Rate', group: 'Vocal' },
    { key: 'longPauses', label: 'Long Pauses', group: 'Vocal' },
    { key: 'pitchVariation', label: 'Pitch Variation', group: 'Vocal' },
];

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const RANGES = [
    { key: '24h', label: '24h', ms: DAY },
    { key: '7d', label: '7d', ms: 7 * DAY },
    { key: '30d', label: '30d', ms: 30 * DAY },
    { key: '90d', label: '90d', ms: 90 * DAY },
    { key: '1y', label: '1y', ms: 365 * DAY },
    { key: 'all', label: 'All', ms: null },
];

const hasValue = (v) => v !== null && v !== undefined && !Number.isNaN(v);

const valueOf = (session, factorKey) =>
    factorKey === 'overall' ? session.overall_score : session.factors?.[factorKey];

const pctChange = (first, last) => {
    if (!hasValue(first) || !hasValue(last) || first === 0) return null;
    return ((last - first) / first) * 100;
};

const startOfYear = (now) => new Date(new Date(now).getFullYear(), 0, 1).getTime();

const fmtDateTime = (t) => new Date(t).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
});

const scoreColorClass = (v) => {
    if (!hasValue(v)) return 'text-slate-400';
    if (v >= 80) return 'text-green-600';
    if (v >= 60) return 'text-orange-500';
    return 'text-red-500';
};

const scoreBarColor = (v) => (v >= 80 ? '#4ade80' : v >= 60 ? '#fb923c' : '#f87171');

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------
const ChangeText = ({ value, className = '' }) => {
    if (!hasValue(value)) return <span className={`text-slate-500 ${className}`}>—</span>;
    const up = value >= 0;
    return (
        <span className={className} style={{ color: up ? UP_COLOR : DOWN_COLOR }}>
            {up ? '▲' : '▼'} {Math.abs(value).toFixed(2)}%
        </span>
    );
};

const ChartTooltip = ({ active, payload, factorLabel }) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0].payload;
    return (
        <div className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 shadow-xl text-[11px]">
            <div className="text-slate-400 font-semibold">{fmtDateTime(p.t)}</div>
            <div className="text-white font-black text-sm mt-0.5">{factorLabel}: {p.v.toFixed(1)}%</div>
            <div className="text-slate-400 mt-0.5">{[p.role, p.difficulty].filter(Boolean).join(' · ')}</div>
        </div>
    );
};

// Rounded label on the dashed baseline (sits just above the line, at the left).
const BaselinePill = ({ viewBox, text }) => {
    if (!viewBox) return null;
    const w = text.length * 7 + 16;
    const x = viewBox.x + 4;
    const y = viewBox.y - 24;
    return (
        <g>
            <rect x={x} y={y} width={w} height={20} rx={10} fill="#334155" stroke="#475569" />
            <text x={x + w / 2} y={y + 14} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontWeight={700}>{text}</text>
        </g>
    );
};

const FactorRow = ({ label, value, detail }) => (
    <div>
        <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
            <span>{label}</span>
            <span className={`font-black ${scoreColorClass(value)}`}>{hasValue(value) ? `${Math.round(value)}%` : 'N/A'}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            {hasValue(value) && (
                <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: scoreBarColor(value) }}></div>
            )}
        </div>
        {detail && <p className="text-[9px] text-slate-400 mt-0.5">{detail}</p>}
    </div>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const ProgressPage = () => {
    const navigate = useNavigate();
    const userId = localStorage.getItem("userId") || 1;

    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [factorKey, setFactorKey] = useState('overall');
    const [rangeKey, setRangeKey] = useState('all');
    const [lowHighKey, setLowHighKey] = useState('30d');
    const [openingId, setOpeningId] = useState(null);

    useEffect(() => {
        axios.get(`${API}/api/progress-timeline/${userId}`)
            .then(res => {
                const list = (res.data.sessions || [])
                    .filter(s => s.date)
                    .map(s => ({ ...s, t: new Date(s.date).getTime() }))
                    .sort((a, b) => a.t - b.t);
                setSessions(list);
            })
            .catch(err => {
                console.error("Failed to load progress timeline:", err);
                setError("Could not load your progress data.");
            })
            .finally(() => setLoading(false));
    }, []);

    const factor = FACTORS.find(f => f.key === factorKey);
    // All points (for this factor) that have a real value.
    const allPoints = useMemo(() => sessions
        .map(s => ({ t: s.t, v: valueOf(s, factorKey), role: s.role, difficulty: s.difficulty }))
        .filter(p => hasValue(p.v)), [sessions, factorKey]);

    const now = Date.now();
    const pointsSince = (startMs) => allPoints.filter(p => p.t >= startMs);
    const range = RANGES.find(r => r.key === rangeKey);
    const rangeStart = range.ms ? now - range.ms : (allPoints[0]?.t ?? now);
    const points = range.ms ? pointsSince(rangeStart) : allPoints;

    const first = points[0]?.v;
    const last = points[points.length - 1]?.v;
    const change = points.length >= 2 ? pctChange(first, last) : null;

    // Statistics (change over fixed periods, like the reference design).
    const periodChange = (startMs) => {
        const p = pointsSince(startMs);
        return p.length >= 2 ? pctChange(p[0].v, p[p.length - 1].v) : null;
    };
    const stats = [
        { label: '24 hours', value: periodChange(now - DAY) },
        { label: '7 days', value: periodChange(now - 7 * DAY) },
        { label: '30 days', value: periodChange(now - 30 * DAY) },
        { label: '90 days', value: periodChange(now - 90 * DAY) },
        { label: 'YTD', value: periodChange(startOfYear(now)) },
    ];
    const lowHighRanges = { '24h': DAY, '30d': 30 * DAY, '1y': 365 * DAY };
    const lhPoints = pointsSince(now - lowHighRanges[lowHighKey]);
    const low = lhPoints.length ? Math.min(...lhPoints.map(p => p.v)) : null;
    const high = lhPoints.length ? Math.max(...lhPoints.map(p => p.v)) : null;
    const lhLatest = lhPoints.length ? lhPoints[lhPoints.length - 1].v : null;
    const lhPos = hasValue(low) && hasValue(high) && high > low ? ((lhLatest - low) / (high - low)) * 100 : 100;

    // Chart geometry: split colour at the baseline (first value).
    const values = points.map(p => p.v);
    const vMax = values.length ? Math.max(...values) : 100;
    const vMin = values.length ? Math.min(...values) : 0;
    const flat = vMax === vMin;
    const splitOffset = flat ? 0 : Math.min(1, Math.max(0, (vMax - first) / (vMax - vMin)));
    const pad = Math.max(3, (vMax - vMin) * 0.15);
    const yDomain = [Math.max(0, Math.floor(vMin - pad)), Math.min(100, Math.ceil(vMax + pad))];
    const xDomain = range.ms ? [rangeStart, now] : ['dataMin', 'dataMax'];
    const spanMs = range.ms ?? ((points[points.length - 1]?.t ?? now) - (points[0]?.t ?? now));
    const tickFmt = (t) => new Date(t).toLocaleString(undefined,
        spanMs <= 2 * DAY ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' });
    const lineColor = flat ? BASE_COLOR : (last >= first ? UP_COLOR : DOWN_COLOR);

    const openReport = async (sessionId) => {
        setOpeningId(sessionId);
        try {
            const response = await axios.get(`${API}/api/interview-session/${sessionId}`);
            if (response.data.success) navigate('/interview-results', { state: { results: response.data.results } });
        } catch (err) {
            console.error("Error fetching session details:", err);
            alert("Could not load interview details.");
        } finally {
            setOpeningId(null);
        }
    };

    const historyCards = [...sessions].reverse();

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 animate-in fade-in duration-700">
            <div className="max-w-4xl mx-auto space-y-6">

                <div className="flex justify-between items-center">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="group flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-all font-bold text-[10px] uppercase tracking-[0.2em]"
                    >
                        <LayoutDashboard size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                    </button>
                </div>

                <div className="text-center">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Your Progress</h1>
                    <p className="text-slate-500 mt-2 font-medium">See how your scores change over time.</p>
                </div>

                {loading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                        <p className="text-slate-500 font-medium">Loading your progress...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 font-medium">{error}</div>
                )}

                {!loading && !error && sessions.length === 0 && (
                    <div className="bg-white border border-slate-100 rounded-[2rem] p-10 shadow-sm text-center">
                        <AlertCircle className="mx-auto text-slate-400 mb-4" size={40} />
                        <p className="text-slate-600 font-medium mb-6">No completed interviews yet. Finish an interview to start tracking your progress.</p>
                        <button
                            onClick={() => navigate('/InterviewSetup')}
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                        >
                            <Rocket size={16} /> Start a Session
                        </button>
                    </div>
                )}

                {!loading && !error && sessions.length > 0 && (
                    <>
                        {/* ============ MAIN CHART (dark, like the reference design) ============ */}
                        <div className="bg-slate-900 text-slate-100 rounded-[2rem] p-5 md:p-7 shadow-xl">

                            {/* Filter: Factor */}
                            <div className="flex flex-wrap gap-3 mb-5">
                                <label className="flex-1 min-w-[10rem]">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-1">
                                        <SlidersHorizontal size={12} /> Factor
                                    </span>
                                    <select
                                        value={factorKey}
                                        onChange={(e) => setFactorKey(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-100 outline-none focus:border-blue-500"
                                    >
                                        {FACTORS.map(f => (
                                            <option key={f.key} value={f.key}>{f.group ? `${f.group} · ${f.label}` : f.label}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            {/* Header: factor name, latest value, change badge */}
                            <div className="flex items-end justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                                        {factor.label}
                                    </div>
                                    <div className="text-4xl md:text-5xl font-black tracking-tight mt-1">
                                        {hasValue(last) ? `${last.toFixed(1)}%` : '—'}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-semibold mt-1">
                                        {points.length} interview{points.length === 1 ? '' : 's'} in this period
                                    </div>
                                </div>
                                <div
                                    className="px-3 py-2 rounded-xl text-lg font-black text-white whitespace-nowrap"
                                    style={{ backgroundColor: !hasValue(change) ? '#334155' : change >= 0 ? UP_COLOR : DOWN_COLOR }}
                                >
                                    {!hasValue(change) ? '—' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`}
                                </div>
                            </div>

                            {/* Time range buttons */}
                            <div className="flex bg-slate-800 rounded-xl p-1 mt-5 w-full">
                                {RANGES.map(r => (
                                    <button
                                        key={r.key}
                                        type="button"
                                        onClick={() => setRangeKey(r.key)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${rangeKey === r.key ? 'bg-slate-950 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>

                            {/* Chart */}
                            <div className="h-72 mt-4">
                                {points.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-sm text-slate-500 font-semibold text-center px-6">
                                        No {factor.label.toLowerCase()} data in this period.
                                        {factorKey !== 'overall' && ' (Camera / voice factors exist only for Voice + Camera interviews.)'}
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={points} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="progressStroke" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset={0} stopColor={UP_COLOR} />
                                                    <stop offset={splitOffset} stopColor={UP_COLOR} />
                                                    <stop offset={splitOffset} stopColor={DOWN_COLOR} />
                                                    <stop offset={1} stopColor={DOWN_COLOR} />
                                                </linearGradient>
                                                <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset={0} stopColor={UP_COLOR} stopOpacity={0.35} />
                                                    <stop offset={splitOffset} stopColor={UP_COLOR} stopOpacity={0.04} />
                                                    <stop offset={splitOffset} stopColor={DOWN_COLOR} stopOpacity={0.04} />
                                                    <stop offset={1} stopColor={DOWN_COLOR} stopOpacity={0.35} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid vertical={false} stroke="#334155" strokeOpacity={0.6} />
                                            <XAxis
                                                dataKey="t"
                                                type="number"
                                                scale="time"
                                                domain={xDomain}
                                                tickFormatter={tickFmt}
                                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                                axisLine={false}
                                                tickLine={false}
                                                minTickGap={30}
                                            />
                                            <YAxis
                                                orientation="right"
                                                domain={yDomain}
                                                tickFormatter={(v) => `${v}%`}
                                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                                axisLine={false}
                                                tickLine={false}
                                                width={44}
                                            />
                                            {hasValue(first) && (
                                                <ReferenceLine
                                                    y={first}
                                                    stroke={BASE_COLOR}
                                                    strokeDasharray="3 4"
                                                    label={<BaselinePill text={`${first.toFixed(1)}%`} />}
                                                />
                                            )}
                                            <Tooltip
                                                content={<ChartTooltip factorLabel={factor.label} />}
                                                cursor={{ stroke: '#64748b', strokeDasharray: '3 3' }}
                                            />
                                            <Area
                                                type="linear"
                                                dataKey="v"
                                                baseValue={first}
                                                stroke={flat ? lineColor : 'url(#progressStroke)'}
                                                strokeWidth={2}
                                                fill={flat ? 'transparent' : 'url(#progressFill)'}
                                                dot={(props) => {
                                                    const { cx, cy, payload, index } = props;
                                                    if (!hasValue(cx) || !hasValue(cy)) return null;
                                                    const c = flat ? lineColor : (payload.v >= first ? UP_COLOR : DOWN_COLOR);
                                                    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill="#0f172a" stroke={c} strokeWidth={2} />;
                                                }}
                                                activeDot={(props) => {
                                                    const { cx, cy, payload } = props;
                                                    const c = flat ? lineColor : (payload.v >= first ? UP_COLOR : DOWN_COLOR);
                                                    return <circle cx={cx} cy={cy} r={6} fill="#fff" stroke={c} strokeWidth={2} />;
                                                }}
                                                isAnimationActive={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                            {points.length === 1 && (
                                <p className="text-[11px] text-slate-500 text-center mt-1">Only one interview in this period - do another to see a trend line.</p>
                            )}

                            {/* Statistics */}
                            <div className="bg-slate-800/60 rounded-2xl p-4 md:p-5 mt-5">
                                <p className="text-sm font-bold text-slate-300 mb-3">Statistics</p>
                                <div className="grid grid-cols-5 gap-1 text-center">
                                    {stats.map(s => (
                                        <div key={s.label}>
                                            <div className="text-[11px] text-slate-400 font-semibold">{s.label}</div>
                                            <ChangeText value={s.value} className="text-xs md:text-sm font-black mt-1 block" />
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between mt-5">
                                    <span className="text-sm font-semibold text-slate-400">Low / High</span>
                                    <div className="flex bg-slate-900 rounded-lg p-0.5">
                                        {Object.keys(lowHighRanges).map(k => (
                                            <button
                                                key={k}
                                                type="button"
                                                onClick={() => setLowHighKey(k)}
                                                className={`px-3 py-1 rounded-md text-xs font-bold ${lowHighKey === k ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                                            >
                                                {k}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="h-1.5 bg-slate-700 rounded-full mt-3 overflow-hidden">
                                    {hasValue(low) && <div className="h-full bg-slate-400 rounded-full" style={{ width: `${lhPos}%` }}></div>}
                                </div>
                                <div className="flex justify-between mt-2 text-base font-black">
                                    <span>{hasValue(low) ? `${low.toFixed(1)}%` : '—'}</span>
                                    <span>{hasValue(high) ? `${high.toFixed(1)}%` : '—'}</span>
                                </div>
                            </div>
                        </div>

                        {/* ============ HISTORY CARDS (newest first) ============ */}
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                <Calendar size={14} /> Interview History ({historyCards.length})
                            </h3>
                            <div className="space-y-4">
                                {historyCards.map(s => {
                                    const isText = (s.interview_mode || '').toUpperCase() === 'TEXT';
                                    const raw = s.vocal_raw || {};
                                    return (
                                        <div key={s.session_id} className="bg-white border border-slate-100 rounded-[1.5rem] p-5 shadow-sm">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{fmtDateTime(s.t)}</p>
                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                        <span className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full">{s.role}</span>
                                                        {s.difficulty && (
                                                            <span className="bg-orange-100 text-orange-700 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full">{s.difficulty}</span>
                                                        )}
                                                        <span className="bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full">{isText ? 'Text' : 'Voice + Camera'}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Confidence</p>
                                                    <p className={`text-3xl font-black ${scoreColorClass(s.overall_score)}`}>
                                                        {hasValue(s.overall_score) ? `${Math.round(s.overall_score)}%` : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>

                                            {isText ? (
                                                <p className="text-[11px] text-slate-400 font-medium mt-4">Text interview - no camera or voice factors.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-4">
                                                    <div className="space-y-3">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">🎥 Visual</p>
                                                        <FactorRow label="Eye Contact" value={s.factors?.eyeContact} />
                                                        <FactorRow label="Head Pose" value={s.factors?.headPose} />
                                                    </div>
                                                    <div className="space-y-3">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">🎙️ Vocal</p>
                                                        <FactorRow label="Speech Rate" value={s.factors?.speechRate}
                                                            detail={hasValue(raw.speechRate) ? `${raw.speechRate} words per minute` : null} />
                                                        <FactorRow label="Long Pauses" value={s.factors?.longPauses}
                                                            detail={hasValue(raw.longPauses) ? `${raw.longPauses}% of answer time` : null} />
                                                        <FactorRow label="Pitch Variation" value={s.factors?.pitchVariation}
                                                            detail={hasValue(raw.pitchVariation) ? `Variation ${Math.round(raw.pitchVariation * 100)}% of average pitch` : null} />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex justify-end mt-4">
                                                <button
                                                    type="button"
                                                    onClick={() => openReport(s.session_id)}
                                                    disabled={openingId === s.session_id}
                                                    className="text-blue-600 hover:text-blue-500 text-[11px] font-black uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    {openingId === s.session_id ? <Loader2 size={12} className="animate-spin" /> : null}
                                                    View Full Report <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ProgressPage;