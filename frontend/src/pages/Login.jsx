import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaVideo, FaArrowLeft } from "react-icons/fa";
import axios from "axios";

function Login() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {

    try {

      const response = await axios.post(
        "http://127.0.0.1:8000/login",
        {
          email: email,
          password: password
        }
      );

      const user = response.data.user;

      localStorage.setItem("user", JSON.stringify(user));

      alert("Login Successful");

      navigate("/consent");

    } catch (error) {

      console.error(error);

      alert("Login Failed");

    }

  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">

      <div className="w-full max-w-md md:max-w-lg bg-white rounded-2xl shadow-lg p-6 md:p-10">

        {/* Back Button */}
        <Link
          to="/"
          className="flex items-center text-gray-600 mb-6 hover:text-gray-800 text-sm md:text-base"
        >
          <FaArrowLeft className="mr-2" />
          Back to Home
        </Link>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 p-3 md:p-4 rounded-2xl text-white text-xl md:text-2xl">
            <FaVideo />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800">
          Welcome Back
        </h2>

        <p className="text-center text-gray-500 mt-2 mb-8 text-sm md:text-base">
          Login to continue your preparation
        </p>

        {/* Email */}
        <div className="mb-5">
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Email Address
          </label>

          <input
            type="email"
            placeholder="john.doe@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
          />
        </div>

        {/* Password */}
        <div className="mb-2">
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Password
          </label>

          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
          />
        </div>

        {/* Forgot Password */}
        <div className="text-right mb-6">
          <a
            href="#"
            className="text-blue-600 text-sm hover:underline"
          >
            Forgot password?
          </a>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition text-sm md:text-base"
        >
          Login
        </button>

        {/* Signup Link */}
        <p className="text-center text-gray-600 mt-6 text-sm md:text-base">
          Don't have an account?{" "}
          <Link
            to="/signup"
            className="text-blue-600 font-medium hover:underline"
          >
            Sign up
          </Link>
        </p>

      </div>

    </div>
  );
}

export default Login;