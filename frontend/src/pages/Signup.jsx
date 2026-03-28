import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaVideo } from "react-icons/fa";
import axios from "axios";

function Signup() {

  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();

    try {

      await axios.post("http://127.0.0.1:8000/signup", {
        name: name,
        email: email,
        password: password
      });

      alert("Signup Successful!");

      navigate("/verify-otp", { state: { email } });

    } catch (error) {

      console.error(error);
      alert("Signup Failed");

    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">

      <div className="w-full max-w-md md:max-w-lg bg-white shadow-lg rounded-2xl p-6 md:p-8">

        {/* Back */}
        <Link
          to="/"
          className="text-gray-500 flex items-center mb-6 text-sm md:text-base"
        >
          ← Back to Home
        </Link>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="bg-blue-600 p-3 md:p-4 rounded-xl text-white text-lg md:text-xl">
            <FaVideo />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold text-center">
          Create Account
        </h2>

        <p className="text-center text-gray-500 mb-6 text-sm md:text-base">
          Start your interview preparation journey
        </p>

        <form className="space-y-4" onSubmit={handleSignup}>

          {/* Name */}
          <div>
            <label className="text-sm font-medium">
              Full Name
            </label>

            <input
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium">
              Email Address
            </label>

            <input
              type="email"
              placeholder="john.doe@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium">
              Password
            </label>

            <input
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
              required
            />
          </div>

          {/* Button */}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg mt-4 transition text-sm md:text-base"
          >
            Create Account
          </button>

        </form>

        {/* Login Link */}
        <p className="text-center text-gray-500 mt-6 text-sm md:text-base">
          Already have an account?
          <Link to="/login" className="text-blue-600 ml-1 font-medium">
            Login
          </Link>
        </p>

      </div>

    </div>
  );
}

export default Signup;