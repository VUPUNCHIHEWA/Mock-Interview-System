import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Check } from "lucide-react";
import axios from "axios";
import {
  AuthLayout,
  AuthHeading,
  FormAlert,
  TextField,
  PasswordField,
  SubmitButton,
  errorMessage,
} from "../components/Authlayout";

const API = "http://127.0.0.1:8000";

// Left brand panel text
const LoginPanel = () => (
  <>
    <h2 className="text-3xl font-bold leading-tight tracking-tight">
      Practise interviews.
      <br />
      Build real confidence.
    </h2>
    <ul className="mt-7 space-y-3.5 text-[15px] text-blue-50">
      {[
        "Eye contact and head movement through your webcam",
        "Speech rate, pitch variation and pauses from your voice",
        "Clear feedback on what to improve next",
      ].map((t) => (
        <li key={t} className="flex gap-3">
          <Check size={18} strokeWidth={2.4} className="mt-0.5 shrink-0" />
          {t}
        </li>
      ))}
    </ul>
  </>
);

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // Set by the Verify email page after a successful verification
  const justVerified = location.state?.verified === true;

  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/login`, {
        email: email.trim(),
        password,
      });

      const user = response.data.user;
      const token = response.data.access_token;

      localStorage.setItem("user", JSON.stringify(user));
      if (user && user.id) {
        localStorage.setItem("userId", user.id);
      }
      localStorage.setItem("token", token);

      navigate("/consent");
    } catch (err) {
      console.error("Login Error:", err);
      setError(errorMessage(err, "Login failed. Please check your details and try again."));
    } finally {
      setLoading(false);
    }
  };

  // The backend says "Please verify your email first" for unverified accounts.
  const needsVerification = error.toLowerCase().includes("verify");

  return (
    <AuthLayout panel={<LoginPanel />}>
      <AuthHeading title="Log in" subtitle="Welcome back. Continue your interview practice." />

      <form onSubmit={handleLogin} noValidate className="mt-6 space-y-4">
        {justVerified && !error && (
          <FormAlert tone="success">Email verified. Please log in to continue.</FormAlert>
        )}

        {error && (
          <FormAlert>
            {error}
            {needsVerification && (
              <>
                {" "}
                <Link
                  to="/verify-otp"
                  state={{ email: email.trim() }}
                  className="font-medium underline underline-offset-2"
                >
                  Verify now
                </Link>
              </>
            )}
          </FormAlert>
        )}

        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <SubmitButton loading={loading} loadingText="Logging in...">
          Log in
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don't have an account?{" "}
        <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-700">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Login;