import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, Mic, Database, GraduationCap } from "lucide-react";
import { AuthLayout, AuthSteps, AuthHeading } from "../components/Authlayout";
import { APP_NAME } from "../config/Brand";

// ---------------------------------------------------------------------------
// Consent text. Written to match what the app really does (ASSUMPTIONS G1,
// G3, I11). If data handling changes (for example KEEP_AUDIO_RECORDINGS=true
// in backend/.env, or a different AI provider), update this text too.
// ---------------------------------------------------------------------------
const CONSENT_POINTS = [
  {
    icon: Video,
    title: "Camera",
    text: "Your webcam image is analysed live for eye contact and head position. Video is not recorded or saved.",
  },
  {
    icon: Mic,
    title: "Microphone",
    text: "Each spoken answer is recorded and sent to Groq (or Google Gemini if Groq is unavailable) to create a transcript and check the answer. The audio is then deleted.",
  },
  {
    icon: Database,
    title: "What we keep",
    text: "Your scores, transcripts and feedback, saved to your account so you can track your progress.",
  },
  {
    icon: GraduationCap,
    title: "Research use",
    text: "This is a KDU final-year research project. Your scores may be analysed for the study without your name.",
  },
];

function Consent() {
  const navigate = useNavigate();
  const [agree, setAgree] = useState(false);

  const handleAccept = () => {
    if (!agree) return;
    localStorage.setItem("consentAccepted", "true");
    navigate("/dashboard");
  };

  // Without consent the app cannot be used, so the student is logged out.
  const handleDecline = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    localStorage.removeItem("consentAccepted");
    navigate("/", { replace: true });
  };

  return (
    <AuthLayout
      panel={
        <AuthSteps
          current={3}
          title={"One last step\nbefore you start"}
          currentText="Read how your data is used"
        />
      }
      back={null}
      stepLabel="Step 3 of 3"
      wide
    >
      <AuthHeading
        title="Before your interview"
        subtitle={`${APP_NAME} uses your camera and microphone to measure confidence. Here is exactly what happens to that data.`}
      />

      <ul className="mt-6 space-y-4">
        {CONSENT_POINTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <Icon size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="mt-0.5 text-sm text-slate-600">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-xs text-slate-500">Taking part is voluntary. You can stop an interview at any time.</p>

      <label
        htmlFor="consent"
        className={`mt-5 flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
          agree ? "border-blue-200 bg-blue-50/60" : "border-slate-200 hover:bg-slate-50"
        }`}
      >
        <input
          id="consent"
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 accent-blue-600"
        />
        <span className="text-sm text-slate-800">
          I have read this and agree to camera and voice analysis for interview feedback and research.
        </span>
      </label>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleDecline}
          className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={!agree}
          className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          Agree and continue
        </button>
      </div>
    </AuthLayout>
  );
}

export default Consent;