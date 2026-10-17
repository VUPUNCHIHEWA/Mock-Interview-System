import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Video,
  Eye,
  Mic,
  Lightbulb,
  ChartLine,
  ShieldCheck,
  Trash2,
  Menu,
  X,
  ArrowRight,
  Check,
  Plus,
  Minus,
} from "lucide-react";
import { APP_NAME, APP_TAGLINE, INSTITUTION } from "../config/brand";

// ---------------------------------------------------------------------------
// Page content (kept here so the text is easy to edit)
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#privacy", label: "Privacy" },
  { href: "#faq", label: "FAQ" },
];

const FEATURES = [
  {
    icon: Eye,
    title: "Visual confidence",
    text: "Live tracking of eye contact and head movement through your webcam.",
  },
  {
    icon: Mic,
    title: "Vocal confidence",
    text: "Speech rate, pitch variation and long pauses measured from your answers.",
  },
  {
    icon: Lightbulb,
    title: "Explainable feedback",
    text: "See why you got each score and the one thing to fix first.",
  },
  {
    icon: ChartLine,
    title: "Progress tracking",
    text: "Follow your confidence score across sessions and spot what improved.",
  },
];

const STEPS = [
  { title: "Create an account", text: "Sign up with your email and give consent." },
  { title: "Check camera & mic", text: "A quick test makes sure you are seen and heard." },
  { title: "Answer the questions", text: "Questions are read aloud. Reply by voice, like a real interview." },
  { title: "Get your report", text: "See your confidence score and what to work on next." },
];

const PRIVACY_POINTS = [
  {
    icon: ShieldCheck,
    title: "Consent first",
    text: "Nothing is analysed until you agree on the consent screen.",
  },
  {
    icon: Trash2,
    title: "Recordings deleted",
    text: "Audio is used for transcription and scoring, then deleted. Only scores and the transcript are kept.",
  },
  {
    icon: Video,
    title: "Camera not saved",
    text: "Webcam frames are analysed live and are not stored as video.",
  },
];

const FAQS = [
  {
    q: "Do I need a webcam and microphone?",
    a: "Yes. The confidence score uses both your camera (visual) and your voice (vocal). A built-in laptop camera and microphone are enough. Google Chrome on a desktop or laptop works best.",
  },
  {
    q: "How is the confidence score calculated?",
    a: "It is the average of two parts. Visual confidence comes from your eye contact and head position. Vocal confidence comes from your speech rate, pitch variation and long pauses. Your answer content is checked separately and is not part of the confidence score.",
  },
  {
    q: "Is my video or audio saved?",
    a: "Camera frames are analysed live and not saved as video. Your audio is sent to an AI speech service to create a transcript and is then deleted. Only your scores and the transcript are kept in your account.",
  },
  {
    q: `Is ${APP_NAME} free to use?`,
    a: `Yes. ${APP_NAME} is a final-year university research project and is free for students.`,
  },
  {
    q: "Can I practise with my own questions?",
    a: "Yes. Custom Practice lets you add questions for the role you are preparing for. These sessions are kept separate from your main progress.",
  },
];

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------

const Logo = ({ size = "md" }) => {
  const box = size === "sm" ? "h-7 w-7 rounded-md" : "h-8 w-8 rounded-lg";
  const icon = size === "sm" ? 15 : 18;
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className={`${box} grid place-items-center bg-blue-600 text-white`}>
        <Video size={icon} strokeWidth={2.2} />
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-slate-900">{APP_NAME}</span>
    </Link>
  );
};

const SectionHeading = ({ eyebrow, title, text, center = false }) => (
  <div className={center ? "mx-auto max-w-xl text-center" : "max-w-2xl"}>
    <p className="text-sm font-semibold text-blue-600">{eyebrow}</p>
    <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
    {text && <p className="mt-3 text-slate-600">{text}</p>}
  </div>
);

const CheckItem = ({ children, color = "text-green-600" }) => (
  <li className="flex gap-2.5">
    <Check size={16} strokeWidth={2.5} className={`mt-0.5 shrink-0 ${color}`} />
    <span>{children}</span>
  </li>
);

// Score bar used in the sample report
const ScoreBar = ({ label, value, color }) => (
  <div>
    <div className="flex justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
    <div className="mt-1.5 h-2 rounded-full bg-slate-100">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

// Circular score ring (pure SVG, no library needed)
const ScoreRing = ({ value }) => {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - value / 100);
  return (
    <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke="#2563eb" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="-mt-0.5 text-[11px] text-slate-500">out of 100</p>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sample confidence report (hero visual). Numbers are illustrative only and
// are clearly labelled "Sample report" so they are not mistaken for results.
// ---------------------------------------------------------------------------
const SampleReport = () => (
  <div className="relative">
    <div
      className="absolute -inset-4 rounded-3xl sm:-inset-6"
      style={{
        backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
      aria-hidden="true"
    />
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Confidence report</p>
          <p className="text-xs text-slate-500">Session 4 · 6 questions · 12 min</p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
          Sample report
        </span>
      </div>

      <div className="mt-5 flex items-center gap-5 sm:gap-6">
        <ScoreRing value={78} />
        <div className="flex-1 space-y-3.5">
          <ScoreBar label="Visual confidence" value={81} color="bg-blue-600" />
          <ScoreBar label="Vocal confidence" value={74} color="bg-sky-500" />
          <p className="text-xs text-slate-500">
            Level: <span className="font-medium text-slate-700">Moderately confident</span>
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
        {[
          ["Eye contact", 84],
          ["Head stability", 79],
          ["Speech rate", 72],
          ["Pitch variation", 70],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-slate-600">{label}</span>
            <span className="font-medium text-slate-900">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-3 text-sm text-slate-700">
        <span className="font-medium text-blue-700">Top tip:</span> You spoke a little fast in answers 2 and 5.
        Pause briefly before key points.
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Progress preview (product preview section). Illustrative data only.
// ---------------------------------------------------------------------------
const ProgressPreview = () => {
  const points = [
    [40, 98], [120, 92], [200, 85], [280, 78], [360, 70], [440, 63], [500, 60],
  ];
  const line = points.map((p) => p.join(",")).join(" ");
  const area = `M${points.map((p) => p.join(" ")).join(" L")} L500 155 L40 155Z`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
      <div className="flex h-9 items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="ml-3 text-[11px] text-slate-400">{APP_NAME.toLowerCase()} / progress</span>
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Confidence score</p>
            <p className="text-2xl font-bold text-slate-900">
              78 <span className="text-sm font-medium text-green-600">▲ 16 since first session</span>
            </p>
          </div>
          <div className="flex gap-1 text-xs">
            <span className="rounded-md bg-slate-900 px-2.5 py-1 text-white">Overall</span>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-600">Visual</span>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-600">Vocal</span>
          </div>
        </div>

        <svg viewBox="0 0 520 170" className="mt-4 w-full" role="img" aria-label="Example progress chart">
          <g stroke="#f1f5f9">
            {[20, 65, 110, 155].map((y) => (
              <line key={y} x1="30" y1={y} x2="510" y2={y} />
            ))}
          </g>
          <g fontSize="10" fill="#94a3b8">
            <text x="4" y="24">100</text>
            <text x="8" y="69">75</text>
            <text x="8" y="114">50</text>
            <text x="8" y="159">25</text>
          </g>
          <path d={area} fill="#2563eb" opacity="0.08" />
          <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />
          <g fill="#fff" stroke="#2563eb" strokeWidth="2">
            {points.map(([x, y]) => (
              <circle key={x} cx={x} cy={y} r="3.5" />
            ))}
          </g>
        </svg>

        <div className="mt-3 divide-y divide-slate-100 text-sm">
          <div className="flex justify-between py-2.5">
            <span className="text-slate-600">Eye contact</span>
            <span className="font-medium text-green-600">▲ 12</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-slate-600">Speech rate</span>
            <span className="font-medium text-green-600">▲ 9</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-slate-600">Long pauses</span>
            <span className="font-medium text-red-500">▼ 3</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Illustrative data</p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// FAQ item (accordion)
// ---------------------------------------------------------------------------
const FaqItem = ({ q, a, open, onToggle }) => (
  <div className="py-5">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center justify-between gap-4 text-left"
    >
      <span className="font-medium text-slate-900">{q}</span>
      {open ? (
        <Minus size={18} className="shrink-0 text-slate-400" />
      ) : (
        <Plus size={18} className="shrink-0 text-slate-400" />
      )}
    </button>
    {open && <p className="mt-3 pr-8 text-sm leading-relaxed text-slate-600">{a}</p>}
  </div>
);

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------
function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* 1. Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />

          <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="transition-colors hover:text-slate-900">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              Get started
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 pb-4 md:hidden">
            <nav className="flex flex-col py-2">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-2 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/login" className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-medium text-slate-700">
                Log in
              </Link>
              <Link to="/signup" className="rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white">
                Get started
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* 2. Hero */}
        <section className="bg-gradient-to-b from-slate-50 to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 md:pt-20 lg:grid-cols-2 lg:gap-16 lg:pb-24">
            <div>
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                For Sri Lankan IT undergraduates
              </span>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
                Practise interviews.
                <br />
                Build real confidence.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600">
                Answer real IT interview questions on camera and get a clear confidence score, with feedback on your
                eye contact, head movement and voice.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  Start practising free
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-[15px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  See how it works
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                <CheckItem>No installation</CheckItem>
                <CheckItem>Works in your browser</CheckItem>
                <CheckItem>Consent first</CheckItem>
              </ul>
            </div>

            <SampleReport />
          </div>
        </section>

        {/* 3. Features */}
        <section id="features" className="scroll-mt-16 border-t border-slate-100">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <SectionHeading
              eyebrow="Features"
              title="Everything you need to feel ready"
              text={`${APP_NAME} looks at how you answer, not only what you say, and explains every score in plain words.`}
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-slate-200 p-6 transition-shadow hover:shadow-md">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Also included: <span className="text-slate-700">practise with your own questions</span> ·{" "}
              <span className="text-slate-700">CV builder</span>
            </p>
          </div>
        </section>

        {/* 4. How it works */}
        <section id="how-it-works" className="scroll-mt-16 border-y border-slate-100 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <SectionHeading center eyebrow="How it works" title="From sign-up to feedback in four steps" />
            <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              <div className="absolute left-[12%] right-[12%] top-5 hidden h-px bg-slate-300 lg:block" aria-hidden="true" />
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-blue-600 font-semibold text-white ring-8 ring-slate-50">
                    {i + 1}
                  </div>
                  <h3 className="mt-5 font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 px-4 text-sm text-slate-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5. Product preview */}
        <section>
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-5 lg:gap-14 lg:py-24">
            <div className="lg:col-span-2">
              <SectionHeading
                eyebrow="Track your growth"
                title="See your confidence grow, session by session"
                text="Every interview is saved to your history. The progress page shows how each confidence factor changes over time, so you know your practice is working."
              />
              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                <CheckItem color="text-blue-600">Overall, visual and vocal scores over time</CheckItem>
                <CheckItem color="text-blue-600">Factor-by-factor change since your first session</CheckItem>
                <CheckItem color="text-blue-600">Download any report as a PDF</CheckItem>
              </ul>
            </div>
            <div className="lg:col-span-3">
              <ProgressPreview />
            </div>
          </div>
        </section>

        {/* 6. Trust & privacy */}
        <section id="privacy" className="scroll-mt-16 border-y border-slate-100 bg-slate-50">
          <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-20 sm:px-6 lg:grid-cols-3 lg:gap-12">
            <div>
              <p className="text-sm font-semibold text-blue-600">Built for research, built with care</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Your interview data is handled with care</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {APP_NAME} is a final-year research project at {INSTITUTION}, designed to help IT undergraduates walk
                into interviews with more confidence.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-3 lg:col-span-2">
              {PRIVACY_POINTS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-slate-200 bg-white p-5">
                  <Icon size={20} className="text-blue-600" />
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. FAQ */}
        <section id="faq" className="scroll-mt-16">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-24">
            <SectionHeading center eyebrow="FAQ" title="Common questions" />
            <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
              {FAQS.map((item, i) => (
                <FaqItem
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  open={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* 8. Final call to action */}
        <section className="pb-20 lg:pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col items-start justify-between gap-8 rounded-2xl bg-blue-600 px-6 py-10 sm:px-12 sm:py-14 md:flex-row md:items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Ready for your next interview?</h2>
                <p className="mt-2 text-blue-100">Run your first mock interview in under five minutes.</p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link
                  to="/signup"
                  className="rounded-lg bg-white px-5 py-3 text-center text-[15px] font-medium text-blue-700 transition-colors hover:bg-blue-50"
                >
                  Create free account
                </Link>
                <Link
                  to="/login"
                  className="rounded-lg border border-blue-300 px-5 py-3 text-center text-[15px] font-medium text-white transition-colors hover:bg-blue-500"
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 9. Footer */}
      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Logo size="sm" />
              <p className="mt-3 max-w-xs text-sm text-slate-500">{APP_TAGLINE}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Product</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><a href="#features" className="hover:text-slate-900">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-slate-900">How it works</a></li>
                <li><a href="#faq" className="hover:text-slate-900">FAQ</a></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Account</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><Link to="/signup" className="hover:text-slate-900">Create account</Link></li>
                <li><Link to="/login" className="hover:text-slate-900">Log in</Link></li>
                <li><a href="#privacy" className="hover:text-slate-900">Privacy &amp; consent</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col justify-between gap-2 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row">
            <span>© {new Date().getFullYear()} {APP_NAME} · {INSTITUTION} · Final-year research project</span>
            <span>Made in Sri Lanka</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;