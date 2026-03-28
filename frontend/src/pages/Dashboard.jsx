import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

import { CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

import {
  FaPlay,
  FaChartLine,
  FaFileAlt,
  FaBriefcase
} from "react-icons/fa";

const chartData = [
  { date: "Jan 15", score: 65 },
  { date: "Jan 22", score: 72 },
  { date: "Feb 5", score: 68 },
  { date: "Feb 18", score: 78 },
  { date: "Mar 3", score: 82 },
  { date: "Mar 17", score: 87 }
];

function Dashboard() {

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <div className="min-h-screen bg-gray-100">

      {/* NAVBAR */}
      <Navbar />

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 space-y-10">

        {/* WELCOME */}
        <div>

          <h1 className="text-2xl md:text-3xl font-bold">
            Welcome back, {user?.name}!
          </h1>

          <p className="text-gray-500 mt-1">
            Track your progress and improve your interview confidence
          </p>

        </div>

        {/* SCORE SECTION */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* CONFIDENCE CIRCLE */}
          <div className="bg-white p-6 rounded-xl shadow flex flex-col items-center justify-center">

            <div className="w-28 h-28 md:w-32 md:h-32">
              <CircularProgressbar value={87} text={`87%`} />
            </div>

            <p className="mt-4 font-semibold text-gray-700">
              Overall Confidence
            </p>

          </div>

          {/* VISUAL SCORE */}
          <div className="bg-white p-6 rounded-xl shadow">

            <p className="text-gray-500 text-sm">
              Visual Confidence
            </p>

            <h2 className="text-3xl font-bold mt-2">
              82%
            </h2>

            <p className="text-sm text-gray-400">
              Eye contact & posture
            </p>

          </div>

          {/* VOCAL SCORE */}
          <div className="bg-white p-6 rounded-xl shadow">

            <p className="text-gray-500 text-sm">
              Vocal Confidence
            </p>

            <h2 className="text-3xl font-bold mt-2">
              76%
            </h2>

            <p className="text-sm text-gray-400">
              Speech clarity
            </p>

          </div>

          {/* CONTENT SCORE */}
          <div className="bg-white p-6 rounded-xl shadow">

            <p className="text-gray-500 text-sm">
              Content Quality
            </p>

            <h2 className="text-3xl font-bold mt-2">
              89%
            </h2>

            <p className="text-sm text-gray-400">
              Answer relevance
            </p>

          </div>

        </div>

        {/* ACTION BUTTONS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

          <button
            onClick={()=>navigate("/interview")}
            className="bg-blue-600 text-white p-5 rounded-xl flex items-center justify-center gap-3 shadow hover:bg-blue-700 transition"
          >
            <FaPlay />
            Start Interview
          </button>

          <button
            onClick={()=>navigate("/history")}
            className="bg-white p-5 rounded-xl shadow flex items-center justify-center gap-3 hover:bg-gray-50"
          >
            <FaChartLine />
            Performance History
          </button>

          <button
            onClick={()=>navigate("/cv")}
            className="bg-white p-5 rounded-xl shadow flex items-center justify-center gap-3 hover:bg-gray-50"
          >
            <FaFileAlt />
            Manage CV
          </button>

          <button
            onClick={()=>navigate("/jobs")}
            className="bg-white p-5 rounded-xl shadow flex items-center justify-center gap-3 hover:bg-gray-50"
          >
            <FaBriefcase />
            Job Suggestions
          </button>

        </div>

        {/* PERFORMANCE CHART */}
        <div className="bg-white p-6 rounded-xl shadow">

          <h2 className="text-xl font-semibold mb-6">
            Performance Trend
          </h2>

          <ResponsiveContainer width="100%" height={300}>

            <LineChart data={chartData}>

              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="date" />

              <YAxis />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="score"
                stroke="#2563eb"
                strokeWidth={3}
              />

            </LineChart>

          </ResponsiveContainer>

        </div>

        {/* BOTTOM SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* RECENT INTERVIEWS */}
          <div className="bg-white p-6 rounded-xl shadow">

            <h2 className="text-xl font-semibold mb-6">
              Recent Interviews
            </h2>

            <div className="space-y-4">

              <div className="flex justify-between bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="font-semibold">
                    Software Engineer
                  </p>
                  <p className="text-sm text-gray-500">
                    Mar 17, 2026
                  </p>
                </div>
                <p className="text-xl font-bold">
                  89%
                </p>
              </div>

              <div className="flex justify-between bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="font-semibold">
                    Backend Developer
                  </p>
                  <p className="text-sm text-gray-500">
                    Mar 3, 2026
                  </p>
                </div>
                <p className="text-xl font-bold">
                  82%
                </p>
              </div>

            </div>

          </div>

          {/* AI FEEDBACK */}
          <div className="bg-white p-6 rounded-xl shadow">

            <h2 className="text-xl font-semibold mb-6">
              AI Feedback Summary
            </h2>

            <div className="space-y-3">

              <div className="bg-green-100 p-4 rounded-lg">
                ✔ Strong technical explanation
              </div>

              <div className="bg-green-100 p-4 rounded-lg">
                ✔ Good posture and confidence
              </div>

              <div className="bg-yellow-100 p-4 rounded-lg">
                ⚠ Reduce filler words
              </div>

              <div className="bg-yellow-100 p-4 rounded-lg">
                ⚠ Improve eye contact
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Dashboard;