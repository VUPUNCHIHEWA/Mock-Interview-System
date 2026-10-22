import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { Loader2, Video, ChartLine, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, CardHeader, Alert, PageLoader, EmptyState, ScoreBar, scoreTone, btn } from '../components/Ui';

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
// UI redesign (Oct 2026): light style like the rest of the app; the factor
// filter is a row of buttons. Calculations (ranges, baseline, % change,
// statistics, low/high) are unchanged.
// ---------------------------------------------------------------------------

const API = "http://localhost:8000";

const UP_COLOR = '#16a34a';    // above baseline (green-600)
const DOWN_COLOR = '#dc2626';  // below baseline (red-600)
const BASE_COLOR = '#94a3b8';

const FACTORS = [
    { key: 'overall', label: 'Confidence Score', group: null },
    { key: 'eyeContact', label: 'Eye Contact', group: 'Visual' },
    { key: 'headPose', label: 'Head Position', group: 'Visual' },
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

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------
const ChangeText = ({ value, className = '' }) => {
    if (!hasValue(value)) return <span className={`text-slate-400 ${className}`}>—</span>;
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
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
            <div className="text-slate-500">{fmtDateTime(p.t)}</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">{factorLabel}: {p.v.toFixed(1)}</div>
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
            <rect x={x} y={y} width={w} height={20} rx={10} fill="#f1f5f9" stroke="#cbd5e1" />
            <text x={x + w / 2} y={y + 14} textAnchor="middle" fill="#334155" fontSize={11} fontWeight={600}>{text}</text>
        </g>
    );
};

const FactorRow = ({ label, value, detail }) => (
    <div>
        <div className="flex items-baseline justify-between text-sm">
            <span className="text-slate-600">{label}</span>
            <span className={`font-semibold ${scoreTone(value).text}`}>{hasValue(value) ? Math.round(value) : 'N/A'}</span>
        </div>
        <ScoreBar value={value} className="mt-1.5 h-1.5" />
        {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const ProgressPage = () => {
    const navigate = useNavigate();
    const userId = localStorage.getItem("userId");

    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [factorKey, setFactorKey] = useState('overall');
    const [rangeKey, setRangeKey] = useState('all');
    const [lowHighKey, setLowHighKey] = useState('30d');
    const [openingId, setOpeningId] = useState(null);
    const [openError, setOpenError] = useState('');

    useEffect(() => {
        if (!userId) {
            navigate('/login', { replace: true });
            return;
        }
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
                setError("Could not load your progress data. Please check that the backend is running.");
            })
            .finally(() => setLoading(false));
    }, [userId, navigate]);

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
    const lineColor = flat ? '#2563eb' : (last >= first ? UP_COLOR : DOWN_COLOR);

    const openReport = async (sessionId) => {
        setOpenError('');
        setOpeningId(sessionId);
        try {
            const response = await axios.get(`${API}/api/interview-session/${sessionId}`);
            if (response.data.success) navigate('/interview-results', { state: { results: response.data.results } });
        } catch (err) {
            console.error("Error fetching session details:", err);
            setOpenError("Could not open that report. Please try again.");
        } finally {
            setOpeningId(null);
        }
    };

    const historyCards = [...sessions].reverse();

    if (loading) return <PageLoader text="Loading your progress..." />;

    return (
        <div>
            <PageHeader
                title="Progress"
                description="See how your confidence score and each confidence factor change over time."
                actions={
                    <Link to="/InterviewSetup" className={btn.primary}>
                        <Video size={16} /> New interview
                    </Link>
                }
            />

            {error && <Alert tone="error" className="mt-5">{error}</Alert>}
            {openError && <Alert tone="error" className="mt-5" onClose={() => setOpenError('')}>{openError}</Alert>}

            {!error && sessions.length === 0 && (
                <div className="mt-6">
                    <EmptyState
                        icon={ChartLine}
                        title="No completed interviews yet"
                        text="Finish an interview to start tracking your progress. Your chart appears after your first interview."
                        action={<Link to="/InterviewSetup" className={btn.primary}>Start an interview <ArrowRight size={16} /></Link>}
                    />
                </div>
            )}

            {!error && sessions.length > 0 && (
                <>
                    {/* ============ MAIN CHART ============ */}
                    <Card className="mt-6 p-5 sm:p-6">
                        {/* Factor filter */}
                        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Factor">
                            {FACTORS.map(f => (
                                <button
                                    key={f.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={factorKey === f.key}
                                    onClick={() => setFactorKey(f.key)}
                                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm transition-colors ${factorKey === f.key
                                        ? 'border-blue-600 bg-blue-50 font-medium text-blue-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                >
                                    {f.group && <span className="mr-1 text-xs text-slate-400">{f.group}</span>}
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Header: factor name, latest value, change badge */}
                        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-slate-500">{factor.label} · latest</p>
                                <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
                                    {hasValue(last) ? last.toFixed(1) : '—'}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {points.length} interview{points.length === 1 ? '' : 's'} in this period
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500">Change in this period</p>
                                <span
                                    className="mt-1 inline-block whitespace-nowrap rounded-lg px-3 py-1.5 text-base font-semibold"
                                    style={!hasValue(change)
                                        ? { backgroundColor: '#f1f5f9', color: '#64748b' }
                                        : { backgroundColor: change >= 0 ? '#f0fdf4' : '#fef2f2', color: change >= 0 ? UP_COLOR : DOWN_COLOR }}
                                >
                                    {!hasValue(change) ? '—' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`}
                                </span>
                            </div>
                        </div>

                        {/* Time range buttons */}
                        <div className="mt-5 flex w-full rounded-lg bg-slate-100 p-1">
                            {RANGES.map(r => (
                                <button
                                    key={r.key}
                                    type="button"
                                    onClick={() => setRangeKey(r.key)}
                                    aria-pressed={rangeKey === r.key}
                                    className={`flex-1 rounded-md py-1.5 text-sm transition-colors ${rangeKey === r.key ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        {/* Chart */}
                        <div className="mt-4 h-72">
                            {points.length === 0 ? (
                                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
                                    No {factor.label.toLowerCase()} data in this period.
                                    {factorKey !== 'overall' && ' (Camera / voice factors exist only for voice + camera interviews.)'}
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
                                                <stop offset={0} stopColor={UP_COLOR} stopOpacity={0.18} />
                                                <stop offset={splitOffset} stopColor={UP_COLOR} stopOpacity={0.02} />
                                                <stop offset={splitOffset} stopColor={DOWN_COLOR} stopOpacity={0.02} />
                                                <stop offset={1} stopColor={DOWN_COLOR} stopOpacity={0.18} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid vertical={false} stroke="#e2e8f0" />
                                        <XAxis
                                            dataKey="t"
                                            type="number"
                                            scale="time"
                                            domain={xDomain}
                                            tickFormatter={tickFmt}
                                            tick={{ fill: '#64748b', fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            minTickGap={30}
                                        />
                                        <YAxis
                                            orientation="right"
                                            domain={yDomain}
                                            tick={{ fill: '#64748b', fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={36}
                                        />
                                        {hasValue(first) && (
                                            <ReferenceLine
                                                y={first}
                                                stroke={BASE_COLOR}
                                                strokeDasharray="3 4"
                                                label={<BaselinePill text={`Start ${first.toFixed(1)}`} />}
                                            />
                                        )}
                                        <Tooltip
                                            content={<ChartTooltip factorLabel={factor.label} />}
                                            cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
                                        />
                                        <Area
                                            type="linear"
                                            dataKey="v"
                                            baseValue={first}
                                            stroke={flat ? lineColor : 'url(#progressStroke)'}
                                            strokeWidth={2.5}
                                            fill={flat ? 'transparent' : 'url(#progressFill)'}
                                            dot={(props) => {
                                                const { cx, cy, payload, index } = props;
                                                if (!hasValue(cx) || !hasValue(cy)) return null;
                                                const c = flat ? lineColor : (payload.v >= first ? UP_COLOR : DOWN_COLOR);
                                                return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill="#fff" stroke={c} strokeWidth={2} />;
                                            }}
                                            activeDot={(props) => {
                                                const { cx, cy, payload } = props;
                                                const c = flat ? lineColor : (payload.v >= first ? UP_COLOR : DOWN_COLOR);
                                                return <circle cx={cx} cy={cy} r={6} fill={c} stroke="#fff" strokeWidth={2} />;
                                            }}
                                            isAnimationActive={false}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        <p className="mt-2 text-center text-xs text-slate-500">
                            {points.length === 1
                                ? 'Only one interview in this period - do another to see a trend line.'
                                : 'Dashed line = your first score in this period. Green = above it, red = below it.'}
                        </p>
                    </Card>

                    {/* ============ STATISTICS ============ */}
                    <div className="mt-5 grid gap-5 lg:grid-cols-3">
                        <Card className="p-5 sm:p-6 lg:col-span-2">
                            <h2 className="text-base font-semibold text-slate-900">Change over time</h2>
                            <p className="mt-0.5 text-sm text-slate-500">{factor.label}: first to latest score in each period.</p>
                            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                                {stats.map(st => (
                                    <div key={st.label} className="rounded-lg bg-slate-50 px-3 py-2.5 text-center">
                                        <div className="text-xs text-slate-500">{st.label}</div>
                                        <ChangeText value={st.value} className="mt-1 block text-sm font-semibold" />
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card className="p-5 sm:p-6">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-base font-semibold text-slate-900">Low / high</h2>
                                <div className="flex rounded-lg bg-slate-100 p-0.5">
                                    {Object.keys(lowHighRanges).map(k => (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => setLowHighKey(k)}
                                            aria-pressed={lowHighKey === k}
                                            className={`rounded-md px-2.5 py-1 text-xs ${lowHighKey === k ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500'}`}
                                        >
                                            {k}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                                {hasValue(low) && <div className="h-full rounded-full bg-blue-600" style={{ width: `${lhPos}%` }} />}
                            </div>
                            <div className="mt-2 flex justify-between text-sm">
                                <span><span className="text-xs text-slate-500">Low </span><b className="text-slate-900">{hasValue(low) ? low.toFixed(1) : '—'}</b></span>
                                <span><span className="text-xs text-slate-500">High </span><b className="text-slate-900">{hasValue(high) ? high.toFixed(1) : '—'}</b></span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">The bar shows where your latest score sits between them.</p>
                        </Card>
                    </div>

                    {/* ============ HISTORY (newest first) ============ */}
                    <Card className="mt-5">
                        <CardHeader
                            title="Interview by interview"
                            description={`${historyCards.length} completed interview${historyCards.length === 1 ? '' : 's'}, newest first.`}
                        />
                        <ul className="divide-y divide-slate-100">
                            {historyCards.map(s => {
                                const isText = (s.interview_mode || '').toUpperCase() === 'TEXT';
                                const raw = s.vocal_raw || {};
                                return (
                                    <li key={s.session_id} className="px-5 py-5 sm:px-6">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{fmtDateTime(s.t)}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">{isText ? 'Text only' : 'Voice + camera'}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-500">Confidence</p>
                                                    <p className={`text-2xl font-bold ${scoreTone(s.overall_score).text}`}>
                                                        {hasValue(s.overall_score) ? Math.round(s.overall_score) : 'N/A'}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => openReport(s.session_id)}
                                                    disabled={openingId === s.session_id}
                                                    className={`${btn.secondary} py-2`}
                                                >
                                                    {openingId === s.session_id && <Loader2 size={15} className="animate-spin" />}
                                                    Report
                                                </button>
                                            </div>
                                        </div>

                                        {isText ? (
                                            <p className="mt-3 text-xs text-slate-500">Text interview - no camera or voice factors.</p>
                                        ) : (
                                            <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                                                <div className="space-y-3">
                                                    <p className="text-xs font-medium text-slate-500">Visual</p>
                                                    <FactorRow label="Eye contact" value={s.factors?.eyeContact} />
                                                    <FactorRow label="Head position" value={s.factors?.headPose} />
                                                </div>
                                                <div className="space-y-3">
                                                    <p className="text-xs font-medium text-slate-500">Vocal</p>
                                                    <FactorRow label="Speech rate" value={s.factors?.speechRate}
                                                        detail={hasValue(raw.speechRate) ? `${raw.speechRate} words per minute` : null} />
                                                    <FactorRow label="Long pauses" value={s.factors?.longPauses}
                                                        detail={hasValue(raw.longPauses) ? `${raw.longPauses}% of answer time` : null} />
                                                    <FactorRow label="Pitch variation" value={s.factors?.pitchVariation}
                                                        detail={hasValue(raw.pitchVariation) ? `Variation ${Math.round(raw.pitchVariation * 100)}% of average pitch` : null} />
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </Card>
                </>
            )}
        </div>
    );
};

export default ProgressPage;