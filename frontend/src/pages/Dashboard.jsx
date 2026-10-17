import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Video, ArrowRight, Target, Loader2, AlertCircle } from "lucide-react";
import { useCurrentUser } from "../utils/currentUser";

const API = "http://localhost:8000";

// ---------------------------------------------------------------------------
// Data sources (no new backend code needed):
//   /api/interview-history/{id}  -> every standard interview (newest first),
//                                   used for the "Recent interviews" table
//   /api/progress-timeline/{id}  -> completed interviews (oldest first) with
//                                   confidence score, visual / vocal parts and
//                                   the 5 factor scores
// Custom Practice sessions are not included in either list (ASSUMPTIONS D7).
// ---------------------------------------------------------------------------

// Factor names and a short tip for the "Focus area" card (ASSUMPTIONS I16)
const FACTORS = {
  eyeContact: { label: "Eye contact", tip: "Look at the camera more often while you answer." },
  headPose: { label: "Head position", tip: "Keep your head facing the screen and steady." },
  speechRate: { label: "Speech rate", tip: "Aim for a steady, comfortable speaking pace." },
  longPauses: { label: "Long pauses", tip: "Try to keep pauses between ideas short." },
  pitchVariation: { label: "Pitch variation", tip: "Vary your tone a little to sound more engaged." },
};

const hasValue = (v) => typeof v === "number" && !Number.isNaN(v);
const round = (v) => (hasValue(v) ? Math.round(v) : null);

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

// First word of the display name (Profile name if filled in, else Sign up name)
const firstWord = (name) => (name || "").trim().split(/\s+/)[0] || "";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "";
const fmtShort = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");

const daysAgo = (d) => {
  if (!d) return "";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------
const Card = ({ className = "", children }) => (
  <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</section>
);

const LinkArrow = ({ to, onClick, children }) =>
  onClick ? (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
      {children} <ArrowRight size={14} />
    </button>
  ) : (
    <Link to={to} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
      {children} <ArrowRight size={14} />
    </Link>
  );

const ScoreRing = ({ value, size = 128 }) => {
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
          <p className="text-3xl font-bold tracking-tight text-slate-900">{hasValue(value) ? Math.round(value) : "—"}</p>
          <p className="-mt-0.5 text-[11px] text-slate-500">out of 100</p>
        </div>
      </div>
    </div>
  );
};

const PartBar = ({ label, value, color }) => (
  <div>
    <div className="flex justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{hasValue(value) ? Math.round(value) : "—"}</span>
    </div>
    <div className="mt-1.5 h-2 rounded-full bg-slate-100">
      {hasValue(value) && <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />}
    </div>
  </div>
);

const Change = ({ value, suffix }) => {
  if (!hasValue(value)) return null;
  const up = value >= 0;
  return (
    <p className="text-sm">
      <span className={`font-medium ${up ? "text-green-600" : "text-red-500"}`}>
        {up ? "▲" : "▼"} {Math.abs(Math.round(value))}
      </span>{" "}
      <span className="text-slate-500">{suffix}</span>
    </p>
  );
};

// Simple SVG line chart for the last few confidence scores
const TrendChart = ({ points }) => {
  const W = 620, H = 210, left = 34, right = 610, top = 15, bottom = 180;
  const xs = points.length > 1 ? points.map((_, i) => 50 + (i * (590 - 50)) / (points.length - 1)) : [320];
  const y = (v) => bottom - ((v - 0) / 100) * (bottom - top);
  const coords = points.map((p, i) => [xs[i], y(p.v)]);
  const line = coords.map((c) => c.join(",")).join(" ");
  const area = coords.length > 1 ? `M${coords.map((c) => c.join(" ")).join(" L")} L${xs[xs.length - 1]} ${bottom} L${xs[0]} ${bottom}Z` : "";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Confidence score over your recent interviews">
      <g stroke="#f1f5f9">
        {[100, 75, 50, 25].map((v) => <line key={v} x1={left} y1={y(v)} x2={right} y2={y(v)} />)}
      </g>
      <g fontSize="11" fill="#94a3b8">
        {[100, 75, 50, 25].map((v) => <text key={v} x={v === 100 ? 4 : 10} y={y(v) + 4}>{v}</text>)}
      </g>
      {area && <path d={area} fill="#2563eb" opacity="0.07" />}
      {coords.length > 1 && <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />}
      <g fill="#fff" stroke="#2563eb" strokeWidth="2">
        {coords.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="4">
            <title>{`${fmtShort(points[i].date)}: ${Math.round(points[i].v)}`}</title>
          </circle>
        ))}
      </g>
      <g fontSize="11" fill="#94a3b8" textAnchor="middle">
        {points.map((p, i) => <text key={i} x={xs[i]} y={H - 8}>{fmtShort(p.date)}</text>)}
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Empty state for a new student
// ---------------------------------------------------------------------------
const EmptyState = ({ name }) => (
  <div>
    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome{name ? `, ${name}` : ""}</h1>
    <p className="mt-1 text-sm text-slate-500">Your confidence report will appear here after your first interview.</p>

    <Card className="mt-6 border-dashed border-slate-300 px-6 py-10 text-center sm:px-8">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
        <Video size={24} />
      </span>
      <p className="mt-4 font-semibold text-slate-900">No interviews yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
        A mock interview has 6 questions, answered by voice with your camera on. It takes about 10–15 minutes.
      </p>
      <Link
        to="/InterviewSetup"
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        <Video size={16} />
        Start your first interview
      </Link>
    </Card>

    <div className="mt-5 grid gap-4 sm:grid-cols-3">
      {[
        ["1. Check camera & mic", "A quick test before you start."],
        ["2. Answer 6 questions", "Questions are read aloud."],
        ["3. Get your report", "Confidence score and tips."],
      ].map(([t, d]) => (
        <Card key={t} className="p-4">
          <p className="text-sm font-medium text-slate-900">{t}</p>
          <p className="mt-1 text-xs text-slate-500">{d}</p>
        </Card>
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
const Dashboard = () => {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const name = firstWord(useCurrentUser().name);

  const [history, setHistory] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [openingId, setOpeningId] = useState(null);
  const [openError, setOpenError] = useState("");

  useEffect(() => {
    if (!userId) {
      navigate("/login", { replace: true });
      return;
    }
    Promise.allSettled([
      axios.get(`${API}/api/interview-history/${userId}`),
      axios.get(`${API}/api/progress-timeline/${userId}`),
    ]).then(([h, t]) => {
      if (h.status === "fulfilled" && h.value.data?.success) setHistory(h.value.data.history || []);
      if (t.status === "fulfilled" && t.value.data?.success) setTimeline(t.value.data.sessions || []);
      if (h.status === "rejected" && t.status === "rejected") {
        setLoadError("Could not load your interviews. Please check that the backend is running.");
      }
      setLoading(false);
    });
  }, [userId, navigate]);

  const stats = useMemo(() => {
    // Only sessions that have a confidence score (older-formula sessions have none)
    const scored = timeline.filter((s) => hasValue(s.overall_score));
    const latest = scored.length ? scored[scored.length - 1] : null;
    const first = scored.length > 1 ? scored[0] : null;
    const avg = scored.length ? scored.reduce((a, s) => a + s.overall_score, 0) / scored.length : null;

    // Focus area = lowest factor score in the latest scored interview
    let focus = null;
    if (latest?.factors) {
      Object.entries(latest.factors).forEach(([key, v]) => {
        if (FACTORS[key] && hasValue(v) && (!focus || v < focus.value)) focus = { key, value: v };
      });
    }

    const completed = history.filter((s) => s.status === "Completed");
    return {
      latest,
      change: latest && first ? latest.overall_score - first.overall_score : null,
      average: avg,
      completedCount: completed.length,
      lastDate: completed[0]?.createdAt || null,
      trend: scored.slice(-7).map((s) => ({ v: s.overall_score, date: s.date })),
      focus,
    };
  }, [history, timeline]);

  // Open a saved report (same way as the My interviews page)
  const openReport = async (sessionId) => {
    setOpenError("");
    setOpeningId(sessionId);
    try {
      const res = await axios.get(`${API}/api/interview-session/${sessionId}`);
      navigate("/interview-results", { state: { results: res.data.results } });
    } catch (err) {
      console.error("Error opening report:", err);
      setOpenError("Could not open that report. Please try again.");
    } finally {
      setOpeningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={36} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        {loadError}
      </div>
    );
  }

  if (history.length === 0) return <EmptyState name={name} />;

  const { latest, change, average, completedCount, lastDate, trend, focus } = stats;
  const recent = history.slice(0, 5);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {greeting()}
            {name ? `, ${name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Here is how your interview confidence is developing.</p>
        </div>
        <Link
          to="/InterviewSetup"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Video size={16} />
          Start interview
        </Link>
      </div>

      {openError && (
        <div className="mt-5 flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {openError}
        </div>
      )}

      {/* Row 1: confidence score + trend */}
      <div className="mt-7 grid gap-5 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Latest confidence score</p>
            {latest && <span className="text-xs text-slate-500">{fmtDate(latest.date)}</span>}
          </div>
          {latest ? (
            <>
              <div className="mt-5 flex items-center gap-5 sm:gap-6">
                <ScoreRing value={latest.overall_score} size={120} />
                <div className="flex-1 space-y-3.5">
                  <PartBar label="Visual" value={latest.visual_score} color="bg-blue-600" />
                  <PartBar label="Vocal" value={latest.vocal_score} color="bg-sky-500" />
                  <Change value={change} suffix="since your first interview" />
                </div>
              </div>
              <div className="mt-5">
                <LinkArrow onClick={() => openReport(latest.session_id)}>
                  {openingId === latest.session_id ? "Opening..." : "View full report"}
                </LinkArrow>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No confidence score yet. Finish an interview with your camera and microphone on to get one.
            </p>
          )}
        </Card>

        <Card className="p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Confidence over time</p>
            <LinkArrow to="/progress">See progress</LinkArrow>
          </div>
          {trend.length >= 2 ? (
            <>
              <p className="mt-0.5 text-xs text-slate-500">
                Your last {trend.length} interview{trend.length > 1 ? "s" : ""}
              </p>
              <TrendChart points={trend} />
            </>
          ) : (
            <div className="grid h-48 place-items-center text-center">
              <p className="max-w-xs text-sm text-slate-500">
                Complete at least 2 interviews to see how your confidence changes over time.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Row 2: small stats + focus area */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Interviews completed</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{completedCount}</p>
          <p className="mt-1 text-xs text-slate-500">{lastDate ? `Last one ${daysAgo(lastDate)}` : "None finished yet"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Average confidence</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{hasValue(average) ? Math.round(average) : "—"}</p>
          <p className="mt-1 text-xs text-slate-500">Across all completed interviews</p>
        </Card>
        {focus ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
              <Target size={16} />
              Focus area
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {FACTORS[focus.key].label} · {round(focus.value)}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              Your lowest factor last time. {FACTORS[focus.key].tip}
            </p>
          </section>
        ) : (
          <Card className="p-5 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Target size={16} />
              Focus area
            </div>
            <p className="mt-2 text-sm text-slate-500">Shown after an interview with factor scores.</p>
          </Card>
        )}
      </div>

      {/* Row 3: recent interviews */}
      <Card className="mt-5">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <p className="text-sm font-semibold text-slate-900">Recent interviews</p>
          <LinkArrow to="/history">View all</LinkArrow>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="px-6 py-2.5 font-medium">Date</th>
                <th className="py-2.5 font-medium">Confidence</th>
                <th className="py-2.5 font-medium">Answer score</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="py-2.5 pr-6" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((s) => {
                const t = timeline.find((x) => x.session_id === s.sessionId);
                const done = s.status === "Completed";
                return (
                  <tr key={s.sessionId}>
                    <td className="px-6 py-3 text-slate-700">{fmtDateTime(s.createdAt)}</td>
                    <td className="py-3 font-semibold text-slate-900">{hasValue(s.overallScore) ? Math.round(s.overallScore) : "—"}</td>
                    <td className="py-3 text-slate-500">{hasValue(t?.textual_score) ? Math.round(t.textual_score) : "—"}</td>
                    <td className="py-3">
                      {done ? (
                        <span className="text-xs font-medium text-green-700">● Completed</span>
                      ) : (
                        <span className="text-xs font-medium text-slate-500">● Not finished</span>
                      )}
                    </td>
                    <td className="py-3 pr-6 text-right">
                      {done && (
                        <button
                          type="button"
                          onClick={() => openReport(s.sessionId)}
                          disabled={openingId === s.sessionId}
                          className="font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-400"
                        >
                          {openingId === s.sessionId ? "Opening..." : "View"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;