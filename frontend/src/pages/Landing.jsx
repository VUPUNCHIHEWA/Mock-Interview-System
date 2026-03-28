import React from "react";
import heroImage from "../assets/hero.jpg";
import { FaVideo, FaFileAlt, FaGithub, FaChartLine } from "react-icons/fa";
import { Link } from "react-router-dom";

function Landing() {
  return (
    <div className="bg-gray-50 min-h-screen">

      {/* Navbar */}
      <nav className="flex justify-between items-center px-6 md:px-12 py-4 bg-white shadow-sm">

        {/* Icon + Title */}
<div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 mb-6 text-center">

  <div className="bg-blue-500 p-2 rounded-xl text-white text-lg md:text-xl">
    <FaVideo />
  </div>

  <h1 className="text-base md:text-xl font-bold text-blue-600 leading-tight">
    Multimodal AI <br className="md:hidden" />
    Mock Interview System
  </h1>

</div>

        

        <div className="flex items-center gap-4">

          <Link to="/login">
            <button className="text-gray-700">
              Login
            </button>
          </Link>

          <Link to="/signup">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
              Get Started
            </button>
          </Link>

        </div>

      </nav>

      {/* Hero Section */}
      <section className="grid md:grid-cols-2 grid-cols-1 gap-10 px-6 md:px-20 py-16 items-center">

        {/* Left Side */}
        <div>

          <span className="bg-blue-100 text-blue-600 px-4 py-1 rounded-full text-sm">
            AI-Powered Career Preparation
          </span>

          <h1 className="text-3xl md:text-5xl font-bold mt-6 text-gray-800">
            AI-Powered Mock Interviews for IT Careers
          </h1>

          <p className="text-gray-600 mt-6 text-lg">
            Practice mock interviews with AI-powered confidence analysis and
            receive detailed feedback on your facial behavior, speech
            characteristics, and answer quality.
          </p>

          <div className="mt-8 flex gap-4">

            <Link to="/signup">
              <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">
                Get Started for Free
              </button>
            </Link>

            <Link to="/login">
              <button className="border px-6 py-3 rounded-lg hover:bg-gray-100 transition">
                Login
              </button>
            </Link>

          </div>

        </div>

        {/* Hero Image */}
        <div className="relative">

          <img
            src={heroImage}
            alt="Mock Interview"
            className="w-full max-h-[600px] object-cover rounded-xl shadow"
          />

          {/* Confidence Score Card */}
          <div className="absolute bottom-6 left-6 bg-white shadow-lg px-5 py-3 rounded-xl">

            <p className="text-gray-500 text-sm">
              Confidence Score
            </p>

            <h3 className="text-xl font-bold text-green-600">
              87%
            </h3>

          </div>

        </div>

      </section>

      {/* Features Section */}
      <section className="px-6 md:px-20 py-16 bg-white">

        <h2 className="text-3xl font-bold text-center mb-12">
          Comprehensive Interview Preparation
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

          <div className="p-6 border rounded-xl shadow-sm hover:shadow-md transition">

            <div className="text-blue-600 text-3xl mb-4">
              <FaVideo />
            </div>

            <h3 className="text-xl font-semibold mb-3">
              Confidence Scoring
            </h3>

            <p className="text-gray-600">
              Multimodal analysis of facial expressions, speech patterns,
              and behavioral cues to evaluate candidate confidence.
            </p>

          </div>


          <div className="p-6 border rounded-xl shadow-sm hover:shadow-md transition">

            <div className="text-green-600 text-3xl mb-4">
              <FaFileAlt />
            </div>

            <h3 className="text-xl font-semibold mb-3">
              CV Analysis
            </h3>

            <p className="text-gray-600">
              Extract skills from uploaded CVs and identify skill gaps
              relevant to targeted IT roles.
            </p>

          </div>


          <div className="p-6 border rounded-xl shadow-sm hover:shadow-md transition">

            <div className="text-purple-600 text-3xl mb-4">
              <FaGithub />
            </div>

            <h3 className="text-xl font-semibold mb-3">
              GitHub Review
            </h3>

            <p className="text-gray-600">
              Analyze GitHub repositories to evaluate coding experience
              and technical portfolio strength.
            </p>

          </div>


          <div className="p-6 border rounded-xl shadow-sm hover:shadow-md transition">

            <div className="text-orange-500 text-3xl mb-4">
              <FaChartLine />
            </div>

            <h3 className="text-xl font-semibold mb-3">
              Performance Tracking
            </h3>

            <p className="text-gray-600">
              Track interview progress over time and compare
              confidence scores across multiple sessions.
            </p>

          </div>

        </div>

      </section>

      {/* How It Works */}
      <section className="px-6 md:px-20 py-16 bg-gray-50">

        <h2 className="text-3xl font-bold text-center mb-12">
          How the System Works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 text-center">

          <div>
            <h3 className="font-bold text-blue-600 text-lg">1</h3>
            <p>Select Target IT Role</p>
          </div>

          <div>
            <h3 className="font-bold text-blue-600 text-lg">2</h3>
            <p>Start Mock Interview</p>
          </div>

          <div>
            <h3 className="font-bold text-blue-600 text-lg">3</h3>
            <p>Capture Video, Audio & Text</p>
          </div>

          <div>
            <h3 className="font-bold text-blue-600 text-lg">4</h3>
            <p>AI Analyzes Confidence</p>
          </div>

          <div>
            <h3 className="font-bold text-blue-600 text-lg">5</h3>
            <p>Receive Feedback & Results</p>
          </div>

        </div>

      </section>

      {/* Footer */}
      <footer className="bg-white px-6 md:px-20 py-10 border-t text-center">

        <h3 className="font-bold text-lg mb-2">
          Multimodal AI Mock Interview System
        </h3>

        <p className="text-gray-600">
          AI-powered interview preparation platform designed to help IT
          students improve confidence and communication skills.
        </p>

        <p className="text-gray-400 mt-4 text-sm">
          © 2026 Multimodal AI Mock Interview System – Final Year Research Project
        </p>

      </footer>

    </div>
  );
}

export default Landing;