import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Consent from "./pages/Consent";
import Dashboard from "./pages/Dashboard";

import Interview from "./pages/Interview";
import History from "./pages/History";
import CV from "./pages/CV";
import Jobs from "./pages/Jobs";
import VerifyOTP from "./pages/VerifyOTP";

function App(){

return(

<BrowserRouter>

<Routes>

<Route path="/" element={<Landing />} />
<Route path="/login" element={<Login />} />
<Route path="/signup" element={<Signup />} />
<Route path="/consent" element={<Consent />} />

<Route path="/dashboard" element={<Dashboard />} />

<Route path="/interview" element={<Interview />} />
<Route path="/history" element={<History />} />
<Route path="/cv" element={<CV />} />
<Route path="/jobs" element={<Jobs />} />
<Route path="/verify-otp" element={<VerifyOTP />} />

</Routes>

</BrowserRouter>

)

}

export default App