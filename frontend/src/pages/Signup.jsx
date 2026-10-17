import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  AuthLayout,
  AuthSteps,
  AuthHeading,
  FormAlert,
  TextField,
  PasswordField,
  SubmitButton,
  errorMessage,
} from "../components/Authlayout";

const API = "http://127.0.0.1:8000";

// Must match MIN_PASSWORD_LENGTH in backend/app/services/auth_service.py
const MIN_PASSWORD_LENGTH = 8;

// Simple email format check (the backend sends a code to confirm it is real)
const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) return setError("Please enter your full name.");
    if (!looksLikeEmail(cleanEmail)) return setError("Please enter a valid email address.");
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    setLoading(true);
    try {
      // Target role and experience level were removed from this form:
      // the interview has no role selection (ASSUMPTIONS D1) and the
      // experience level was never used. The backend treats both as optional.
      await axios.post(`${API}/signup`, {
        name: cleanName,
        email: cleanEmail,
        password,
      });

      navigate("/verify-otp", { state: { email: cleanEmail } });
    } catch (err) {
      console.error(err);
      setError(errorMessage(err, "Sign up failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      panel={<AuthSteps current={1} title={"Get started in\nthree short steps"} />}
      stepLabel="Step 1 of 3"
    >
      <AuthHeading title="Create your account" subtitle="Free for students. Takes less than a minute." />

      <form onSubmit={handleSignup} noValidate className="mt-6 space-y-4">
        {error && <FormAlert>{error}</FormAlert>}

        <TextField
          id="name"
          label="Full name"
          type="text"
          autoComplete="name"
          placeholder="e.g. Kasun Perera"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          hint="We'll send a 6-digit code to verify it."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <PasswordField
          id="password"
          label="Password"
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <SubmitButton loading={loading} loadingText="Creating account...">
          Create account
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Signup;