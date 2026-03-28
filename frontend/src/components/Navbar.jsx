import React from "react";
import { useNavigate } from "react-router-dom";
import { FaVideo, FaArrowLeft } from "react-icons/fa";

function Navbar({ showBack }) {

  const navigate = useNavigate();

  return (
    <nav className="flex justify-between items-center px-6 md:px-12 py-4 bg-white shadow-sm">

      {/* Logo */}
      <div className="flex items-center gap-3">

        <div className="bg-blue-500 p-2 rounded-xl text-white text-lg">
          <FaVideo />
        </div>

        <h1 className="text-base md:text-xl font-bold text-blue-600 leading-tight">
          Multimodal AI
          <span className="hidden md:inline"> Mock Interview System</span>
          <span className="md:hidden block">Mock Interview System</span>
        </h1>

      </div>

      {/* Back Button */}
      {showBack && (
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600"
        >
          <FaArrowLeft />
          Back to Dashboard
        </button>
      )}

    </nav>
  );
}

export default Navbar;