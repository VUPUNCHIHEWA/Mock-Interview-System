import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail } from "lucide-react";
import axios from "axios";
import {
  AuthLayout,
  AuthSteps,
  AuthHeading,
  FormAlert,
  TextField,
  SubmitButton,
  errorMessage,
} from "../components/Authlayout";

const API = "http://127.0.0.1:8000";

// The backend creates a 6-digit code (otp_service.generate_otp)
const CODE_LENGTH = 6;
// Seconds before "Resend code" can be used (same as before)
const RESEND_WAIT = 30;

// ---------------------------------------------------------------------------
// Six single-digit boxes. Typing moves to the next box, Backspace moves back,
// and pasting a whole code fills all boxes.
// ---------------------------------------------------------------------------
function CodeInput({ value, onChange, disabled }) {
  const refs = useRef([]);
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] || "");

  const focusBox = (i) => {
    const el = refs.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))];
    if (el) el.focus();
  };

  const setFrom = (start, text) => {
    const clean = text.replace(/\D/g, "");
    if (!clean) return;
    const next = digits.slice();
    for (let k = 0; k < clean.length && start + k < CODE_LENGTH; k++) {
      next[start + k] = clean[k];
    }
    onChange(next.join(""));
    focusBox(start + clean.length);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = digits.slice();
      if (next[i]) {
        next[i] = "";
      } else if (i > 0) {
        next[i - 1] = "";
        focusBox(i - 1);
      }
      onChange(next.join(""));
    } else if (e.key === "ArrowLeft") {
      focusBox(i - 1);
    } else if (e.key === "ArrowRight") {
      focusBox(i + 1);
    }
  };

  return (
    <div className="mt-2 flex gap-2 sm:gap-2.5">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={CODE_LENGTH}
          value={d}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => setFrom(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => {
            e.preventDefault();
            setFrom(0, e.clipboardData.getData("text"));
          }}
          onFocus={(e) => e.target.select()}
          className="h-11 w-11 rounded-lg border border-slate-300 text-center text-lg font-semibold text-slate-900 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 sm:h-12 sm:w-12 sm:text-xl"
        />
      ))}
    </div>
  );
}

const formatTime = (s) => `0:${String(s).padStart(2, "0")}`;

function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();

  // Email comes from the Sign up page (or the Log in "Verify now" link).
  // If the page was opened directly / refreshed, the student types it.
  const emailFromState = location.state?.email || "";
  const [email, setEmail] = useState(emailFromState);
  const [code, setCode] = useState("");

  const [timer, setTimer] = useState(RESEND_WAIT);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Resend countdown
  useEffect(() => {
    if (timer <= 0) return undefined;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const verify = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!email.trim()) return setError("Please enter the email you signed up with.");
    if (code.length !== CODE_LENGTH) return setError(`Please enter all ${CODE_LENGTH} digits of the code.`);

    setVerifying(true);
    try {
      await axios.post(`${API}/verify-otp`, { email: email.trim(), otp: code });
      navigate("/login", { replace: true, state: { verified: true, email: email.trim() } });
    } catch (err) {
      setError(errorMessage(err, "That code is not correct. Please check it and try again."));
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    setError("");
    setInfo("");
    if (!email.trim()) return setError("Please enter the email you signed up with.");

    setResending(true);
    try {
      await axios.post(`${API}/resend-otp`, { email: email.trim() });
      setInfo(`A new code was sent to ${email.trim()}.`);
      setCode("");
      setTimer(RESEND_WAIT);
    } catch (err) {
      setError(errorMessage(err, "Could not send a new code. Please try again."));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      panel={<AuthSteps current={2} title={"Get started in\nthree short steps"} />}
      back={{ to: "/signup", label: "Back to sign up" }}
      stepLabel="Step 2 of 3"
    >
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
        <Mail size={22} />
      </div>

      <div className="mt-5">
        <AuthHeading
          title="Check your email"
          subtitle={
            emailFromState ? (
              <>
                We sent a {CODE_LENGTH}-digit code to{" "}
                <span className="font-medium text-slate-800">{emailFromState}</span>.{" "}
                <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-700">
                  Wrong email?
                </Link>
              </>
            ) : (
              <>Enter your email and the {CODE_LENGTH}-digit code we sent you.</>
            )
          }
        />
      </div>

      <form onSubmit={verify} noValidate className="mt-6 space-y-5">
        {error && <FormAlert>{error}</FormAlert>}
        {info && <FormAlert tone="success">{info}</FormAlert>}

        {!emailFromState && (
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}

        <div>
          <label className="text-sm font-medium text-slate-700">Verification code</label>
          <CodeInput value={code} onChange={setCode} disabled={verifying} />
        </div>

        <SubmitButton loading={verifying} loadingText="Verifying..." disabled={code.length !== CODE_LENGTH}>
          Verify email
        </SubmitButton>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Didn't get the code?{" "}
        {timer > 0 ? (
          <span className="text-slate-400">Resend in {formatTime(timer)}</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-400"
          >
            {resending ? "Sending..." : "Resend code"}
          </button>
        )}
      </p>
      <p className="mt-2 text-center text-xs text-slate-400">Check your spam folder too.</p>
    </AuthLayout>
  );
}

export default VerifyOTP;