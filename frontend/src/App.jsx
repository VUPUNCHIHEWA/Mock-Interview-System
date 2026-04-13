import { BrowserRouter, Routes, Route } from "react-router-dom";

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


const MainLayout = ({ children }) => (
  <div className="flex min-h-screen bg-[#F8FAFC]">
    <Sidebar />
    <div className="flex-1 p-8 overflow-y-auto">
      {children}
    </div>
  </div>
);

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
      </Routes>
    </BrowserRouter>
  );
}

export default App;