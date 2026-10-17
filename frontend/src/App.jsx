import { useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Menu, Video } from "lucide-react";
import { APP_NAME } from "./config/Brand";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Consent from "./pages/Consent";
import Dashboard from "./pages/Dashboard";
import Sidebar from './components/Sidebar';

import Interview from "./pages/Interview";
import History from "./pages/History";
import CV from "./pages/CV";
import Jobs from "./pages/Jobs";
import VerifyOTP from "./pages/VerifyOTP";
import InterviewSetup from './pages/InterviewSetup';
import InterviewSession from './pages/InterviewSession';
import InterviewResults from './pages/InterviewResults';
import Profile from './pages/Profile';
import ProgressPage from './pages/ProgressPage';
import ISTQBQuizPage from './pages/ISTQBQuizPage';
import CustomPractice from './pages/CustomPractice';
import PracticeHistory from './pages/PracticeHistory';

// Layout for pages inside the app: sidebar on the left (desktop), or a top
// bar with a menu button that opens the sidebar as a drawer (phone).
const MainLayout = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar mobileOpen={menuOpen} onClose={closeMenu} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-blue-600 text-white">
              <Video size={15} strokeWidth={2.2} />
            </span>
            <span className="font-semibold">{APP_NAME}</span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/consent" element={<Consent />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />


        <Route path="/dashboard" element={<MainLayout><Dashboard /></MainLayout>} />
        <Route path="/InterviewSetup" element={<MainLayout><InterviewSetup /></MainLayout>} />
        <Route path="/interview" element={<MainLayout><Interview /></MainLayout>} />
        <Route path="/history" element={<MainLayout><History /></MainLayout>} />
        <Route path="/cv" element={<MainLayout><CV /></MainLayout>} />
        <Route path="/jobs" element={<MainLayout><Jobs /></MainLayout>} />
        <Route path="/profile" element={<MainLayout><Profile /></MainLayout>} />

        <Route path="/interview-session" element={<InterviewSession />} />
        <Route path="/interview-results" element={<MainLayout><InterviewResults /></MainLayout>} />
        <Route path="/progress" element={<MainLayout><ProgressPage /></MainLayout>} />
        <Route path="/istqb-quiz" element={<MainLayout><ISTQBQuizPage /></MainLayout>} />
        {/* Supporting feature: practise with your own questions (not tracked) */}
        <Route path="/custom-practice" element={<MainLayout><CustomPractice /></MainLayout>} />
        <Route path="/practice-history" element={<MainLayout><PracticeHistory /></MainLayout>} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;