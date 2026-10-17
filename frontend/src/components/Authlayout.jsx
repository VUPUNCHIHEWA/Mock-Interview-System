import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Video, ArrowLeft, Eye, EyeOff, AlertCircle, CheckCircle2, Check } from "lucide-react";
import { APP_NAME, INSTITUTION } from "../config/Brand";

// ---------------------------------------------------------------------------
// Shared layout for the Log in, Sign up, Verify email and Consent pages.
// Desktop: blue brand panel on the left, content on the right.
// Phone:   brand panel hidden, small logo bar on top.
// ---------------------------------------------------------------------------

const LogoMark = ({ light = false, small = false }) => (
  <span
    className={`grid place-items-center ${small ? "h-7 w-7 rounded-md" : "h-8 w-8 rounded-lg"} ${
      light ? "border border-white/25 bg-white/15 text-white" : "bg-blue-600 text-white"
    }`}
  >
    <Video size={small ? 15 : 18} strokeWidth={2.2} />
  </span>
);

/**
 * props:
 *  panel      – content for the blue panel (desktop)
 *  back       – { to, label, state } for the top-left link; null hides it. Default: Back to home
 *  stepLabel  – e.g. "Step 2 of 3", shown on phones instead of the Home link
 *  wide       – use a wider content column (Consent page)
 */
export function AuthLayout({
  panel,
  children,
  back = { to: "/", label: "Back to home" },
  stepLabel,
  wide = false,
}) {
  return (
    <div className="grid min-h-screen bg-white text-slate-900 lg:grid-cols-2">
      {/* Brand panel (desktop only) */}
      <aside className="relative hidden flex-col bg-blue-600 p-12 text-white lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,.18) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
          aria-hidden="true"
        />
        <Link to="/" className="relative flex items-center gap-2.5">
          <LogoMark light />
          <span className="text-[17px] font-semibold">{APP_NAME}</span>
        </Link>
        <div className="relative mt-auto max-w-md">{panel}</div>
        <p className="relative mt-auto pt-10 text-xs text-blue-200">
          Final-year research project · {INSTITUTION}
        </p>
      </aside>

      {/* Content side */}
      <main className="flex flex-col px-5 py-6 sm:px-10 lg:px-16 lg:py-10">
        {/* Phone top bar */}
        <div className="flex items-center justify-between lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <LogoMark small />
            <span className="font-semibold">{APP_NAME}</span>
          </Link>
          {stepLabel ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">{stepLabel}</span>
          ) : (
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-800">
              Home
            </Link>
          )}
        </div>

        {/* Desktop back link */}
        {back && (
          <Link
            to={back.to}
            state={back.state}
            className="hidden w-fit items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-800 lg:flex"
          >
            <ArrowLeft size={16} />
            {back.label}
          </Link>
        )}

        <div className={`mx-auto my-auto w-full py-10 ${wide ? "max-w-md" : "max-w-sm"}`}>{children}</div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The 3 sign-up steps, used in the blue panel of Sign up, Verify and Consent.
// current = 1, 2 or 3. Earlier steps show a tick.
// ---------------------------------------------------------------------------
const STEPS = [
  { title: "Create your account", text: "Name, email and a password" },
  { title: "Verify your email", text: "Enter the 6-digit code we send you" },
  { title: "Give consent and start", text: "Then run your first mock interview" },
];

export const AuthSteps = ({ current, title, currentText }) => (
  <>
    <h2 className="whitespace-pre-line text-3xl font-bold leading-tight tracking-tight">{title}</h2>
    <ol className="mt-7 space-y-4 text-[15px]">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={s.title} className={`flex items-start gap-3.5 ${active ? "" : "opacity-70"}`}>
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                active ? "bg-white text-blue-700" : "border border-white/30 bg-white/15"
              }`}
            >
              {done ? <Check size={14} strokeWidth={3} /> : n}
            </span>
            <div>
              <p className="font-medium">{s.title}</p>
              <p className="text-sm text-blue-100">{done ? "Done" : active && currentText ? currentText : s.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  </>
);

// Page title + subtitle
export const AuthHeading = ({ title, subtitle }) => (
  <div>
    <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
    {subtitle && <div className="mt-1.5 text-sm text-slate-500">{subtitle}</div>}
  </div>
);

// Message box shown inside the form (replaces alert() popups).
// tone = "error" (red) or "success" (green)
export const FormAlert = ({ children, tone = "error" }) => {
  const success = tone === "success";
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={success ? "status" : "alert"}
      className={`flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${
        success ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
};

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10";

// Labelled text input
export const TextField = ({ id, label, hint, ...props }) => (
  <div>
    <label htmlFor={id} className="text-sm font-medium text-slate-700">
      {label}
    </label>
    <input id={id} className={`mt-1.5 ${inputClass}`} {...props} />
    {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
  </div>
);

// Labelled password input with show / hide button
export const PasswordField = ({ id, label, hint, ...props }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input id={id} type={visible ? "text" : "password"} className={`${inputClass} pr-10`} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-600"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
};

// Primary submit button with loading text
export const SubmitButton = ({ loading, loadingText, disabled = false, children }) => (
  <button
    type="submit"
    disabled={loading || disabled}
    className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
  >
    {loading ? loadingText : children}
  </button>
);

// Turns an axios error into one readable sentence
export const errorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (error?.response?.data?.message) return error.response.data.message;
  if (!error?.response) return "Cannot reach the server. Please check that the backend is running.";
  return fallback;
};