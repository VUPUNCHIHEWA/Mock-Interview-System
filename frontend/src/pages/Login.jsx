import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaVideo, FaArrowLeft } from "react-icons/fa";
import axios from "axios";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/login",
        {
          email: email,
          password: password
        }
      );

      
      const user = response.data.user;
      const token = response.data.access_token;

      
      localStorage.setItem("user", JSON.stringify(user));

      
      if (user && user.id) {
        localStorage.setItem("userId", user.id);
      }

      
      localStorage.setItem("token", token);

      alert("Login Successful");
      
      
      navigate("/consent");

    } catch (error) {
      console.error("Login Error:", error);
     
      const errorMsg = error.response?.data?.detail || "Login Failed. Please check your credentials.";
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md md:max-w-lg bg-white rounded-2xl shadow-lg p-6 md:p-10">
        
        {/* Back Button */}
        <Link
          to="/"
          className="flex items-center text-gray-600 mb-6 hover:text-gray-800 text-sm md:text-base transition-colors"
        >
          <FaArrowLeft className="mr-2" />
          Back to Home
        </Link>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 p-3 md:p-4 rounded-2xl text-white text-xl md:text-2xl shadow-lg shadow-blue-100">
            <FaVideo />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800 tracking-tight">
          Welcome Back
        </h2>
        <p className="text-center text-gray-500 mt-2 mb-8 text-sm md:text-base">
          Login to continue your preparation
        </p>

        {/* Email Field */}
        <div className="mb-5 text-left">
          <label className="block mb-2 text-sm font-semibold text-gray-700">
            Email Address
          </label>
          <input
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm md:text-base bg-gray-50"
          />
        </div>

        {/* Password Field */}
        <div className="mb-2 text-left">
          <label className="block mb-2 text-sm font-semibold text-gray-700">
            Password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm md:text-base bg-gray-50"
          />
        </div>

        {/* Forgot Password */}
        <div className="text-right mb-6">
          <button className="text-blue-600 text-sm font-medium hover:text-blue-700 transition-colors">
            Forgot password?
          </button>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full py-3 rounded-xl font-bold text-sm md:text-base transition-all shadow-lg ${
            loading 
            ? "bg-gray-400 cursor-not-allowed" 
            : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-blue-100"
          }`}
        >
          {loading ? "Verifying..." : "Login"}
        </button>

        {/* Signup Link */}
        <p className="text-center text-gray-600 mt-6 text-sm md:text-base">
          Don't have an account?{" "}
          <Link
            to="/signup"
            className="text-blue-600 font-bold hover:underline"
          >
            Sign up
          </Link>
        </p>

      </div>
    </div>
  );
}

export default Login;