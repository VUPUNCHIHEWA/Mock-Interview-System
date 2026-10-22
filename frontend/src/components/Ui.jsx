/* eslint-disable react-refresh/only-export-components -- small shared helpers (button classes, score colours) live next to the components that use them */
import React, { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, Loader2, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Small shared UI pieces for the pages inside the app (UI redesign, Oct 2026).
// Same look as the Dashboard / Results pages: white cards, slate borders,
// blue primary buttons, 8-12 px corners, no alert()/confirm() popups.
// ---------------------------------------------------------------------------

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60",
  icon:
    "inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50",
};

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10";

export const hasValue = (v) => typeof v === "number" && !Number.isNaN(v);

/** Page title row: optional small blue label, title, description and buttons on the right. */
export const PageHeader = ({ eyebrow, title, description, actions, children }) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow && <p className="text-sm font-semibold text-blue-600">{eyebrow}</p>}
      <h1 className={`${eyebrow ? "mt-1" : ""} text-2xl font-bold tracking-tight text-slate-900`}>{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
      {children}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </div>
);

export const Card = ({ className = "", children, ...rest }) => (
  <section className={`rounded-xl border border-slate-200 bg-white ${className}`} {...rest}>
    {children}
  </section>
);

export const CardHeader = ({ title, description, actions }) => (
  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
    <div className="min-w-0">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);

const ALERT_TONES = {
  error: { cls: "border-red-200 bg-red-50 text-red-700", Icon: AlertCircle, role: "alert" },
  success: { cls: "border-green-200 bg-green-50 text-green-800", Icon: CheckCircle2, role: "status" },
  warning: { cls: "border-amber-200 bg-amber-50 text-amber-900", Icon: AlertTriangle, role: "status" },
  info: { cls: "border-blue-200 bg-blue-50 text-blue-900", Icon: Info, role: "note" },
};

/** Message box shown on the page (replaces alert()). */
export const Alert = ({ tone = "info", icon, children, onClose, className = "" }) => {
  const t = ALERT_TONES[tone] || ALERT_TONES.info;
  const Icon = icon || t.Icon;
  return (
    <div role={t.role} className={`flex gap-2.5 rounded-lg border px-4 py-3 text-sm ${t.cls} ${className}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="-mr-1 shrink-0 rounded p-0.5 opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X size={15} />
        </button>
      )}
    </div>
  );
};

/** Full-area loading spinner. */
export const PageLoader = ({ text }) => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center text-slate-500">
    <Loader2 className="animate-spin text-blue-600" size={32} />
    {text && <p className="mt-3 text-sm">{text}</p>}
  </div>
);

/** Shown when a list has nothing in it yet. */
export const EmptyState = ({ icon, title, text, action }) => {
  const Icon = icon;
  return (
    <Card className="border-dashed border-slate-300 px-6 py-12 text-center">
      {Icon && (
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <Icon size={24} />
        </span>
      )}
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
};

/** Confirmation dialog (replaces window.confirm()). */
export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-slate-900/40" onClick={() => !busy && onCancel()} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="flex gap-3">
          {danger && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle size={20} />
            </span>
          )}
          <div>
            <h2 id="confirm-title" className="text-base font-semibold text-slate-900">{title}</h2>
            {message && <p className="mt-1 text-sm text-slate-600">{message}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className={btn.secondary}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={danger ? btn.danger : btn.primary}>
            {busy && <Loader2 size={15} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Score colour (same thresholds used everywhere: 80+ green, 60-79 amber, below 60 red). */
export const scoreTone = (score) => {
  if (!hasValue(score)) return { bar: "bg-slate-300", text: "text-slate-400", soft: "bg-slate-100 text-slate-500" };
  if (score >= 80) return { bar: "bg-green-500", text: "text-green-600", soft: "bg-green-50 text-green-700" };
  if (score >= 60) return { bar: "bg-amber-500", text: "text-amber-600", soft: "bg-amber-50 text-amber-700" };
  return { bar: "bg-red-500", text: "text-red-600", soft: "bg-red-50 text-red-700" };
};

/** Square score tile used in lists. Not finished = "…", no score = "N/A". */
export const ScoreTile = ({ score, finished = true }) => {
  const text = !finished ? "…" : hasValue(score) ? Math.round(score) : "N/A";
  const cls = finished ? scoreTone(score).soft : "bg-slate-100 text-slate-500";
  return (
    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg text-base font-semibold ${cls}`}>{text}</span>
  );
};

export const StatusBadge = ({ completed }) =>
  completed ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-600" /> Completed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Not finished
    </span>
  );

/** Thin score bar. */
export const ScoreBar = ({ value, className = "h-1.5" }) => (
  <div className={`w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
    {hasValue(value) && (
      <div className={`h-full rounded-full ${scoreTone(value).bar}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    )}
  </div>
);

/** Labelled form field wrapper. */
export const Field = ({ id, label, hint, icon, children }) => {
  const Icon = icon;
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {Icon && <Icon size={14} className="text-slate-400" />}
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
};

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";