import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

import { FaUpload, FaGithub } from "react-icons/fa";

function CV() {

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("upload");
  const [github, setGithub] = useState("");

  return (
    <div className="min-h-screen bg-gray-100">

      {/* NAVBAR */}
      <Navbar showBack={true} />

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-10">

        {/* TITLE */}
        <div>

          <h1 className="text-2xl md:text-3xl font-bold">
            CV Management
          </h1>

          <p className="text-gray-500 mt-1">
            Upload your CV and connect GitHub for comprehensive skill analysis
          </p>

        </div>

        {/* TABS */}
        <div className="flex bg-gray-200 rounded-full w-fit p-1">

          <button
            onClick={()=>setActiveTab("upload")}
            className={`px-5 md:px-6 py-2 rounded-full text-sm md:text-base transition ${
              activeTab === "upload"
                ? "bg-white shadow font-medium"
                : "text-gray-600"
            }`}
          >
            Upload CV
          </button>

          <button
            onClick={()=>setActiveTab("build")}
            className={`px-5 md:px-6 py-2 rounded-full text-sm md:text-base transition ${
              activeTab === "build"
                ? "bg-white shadow font-medium"
                : "text-gray-600"
            }`}
          >
            Build CV
          </button>

        </div>

        {/* UPLOAD TAB */}
        {activeTab === "upload" && (

          <div className="space-y-8">

            {/* CV UPLOAD */}
            <div className="bg-white p-6 md:p-8 rounded-xl shadow">

              <h2 className="text-lg md:text-xl font-semibold mb-2">
                Upload Your CV
              </h2>

              <p className="text-gray-500 mb-6">
                Upload a PDF file to extract your skills automatically
              </p>

              <label className="border-2 border-dashed border-gray-300 rounded-xl p-10 md:p-14 text-center block cursor-pointer hover:border-blue-500 transition">

                <div className="bg-blue-100 w-14 h-14 flex items-center justify-center rounded-full mx-auto mb-4">
                  <FaUpload className="text-blue-600 text-xl" />
                </div>

                <p className="font-medium text-gray-700">
                  Click to upload or drag and drop
                </p>

                <p className="text-sm text-gray-500 mt-1">
                  PDF files only (Max 5MB)
                </p>

                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                />

              </label>

            </div>

            {/* GITHUB SECTION */}
            <div className="bg-white p-6 md:p-8 rounded-xl shadow">

              <div className="flex items-center gap-3 mb-5">

                <div className="bg-gray-900 text-white p-3 rounded-lg">
                  <FaGithub />
                </div>

                <div>

                  <h2 className="text-lg md:text-xl font-semibold">
                    GitHub Profile Integration
                  </h2>

                  <p className="text-gray-500 text-sm">
                    Connect your GitHub to analyze your coding activity
                  </p>

                </div>

              </div>

              <div className="flex flex-col md:flex-row gap-3">

                <input
                  type="text"
                  placeholder="https://github.com/username"
                  value={github}
                  onChange={(e)=>setGithub(e.target.value)}
                  className="flex-1 border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button className="bg-black text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-800 transition">
                  <FaGithub />
                  Connect
                </button>

              </div>

              {/* STATS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">

                <div className="bg-gray-50 p-6 rounded-xl">

                  <p className="text-gray-500 text-sm">
                    Total Repositories
                  </p>

                  <h2 className="text-3xl font-bold mt-2">
                    24
                  </h2>

                </div>

                <div className="bg-gray-50 p-6 rounded-xl">

                  <p className="text-gray-500 text-sm">
                    Activity Score
                  </p>

                  <h2 className="text-3xl font-bold text-green-600 mt-2">
                    87%
                  </h2>

                </div>

                <div className="bg-gray-50 p-6 rounded-xl">

                  <p className="text-gray-500 text-sm">
                    Last Active
                  </p>

                  <h2 className="text-2xl font-bold mt-2">
                    2 days ago
                  </h2>

                </div>

              </div>

              {/* TOP LANGUAGES */}
              <div className="mt-8">

                <h3 className="font-semibold mb-4">
                  Top Languages
                </h3>

                <div className="space-y-4">

                  {[
                    {name:"JavaScript",value:45},
                    {name:"TypeScript",value:30},
                    {name:"Python",value:15},
                    {name:"CSS",value:10}
                  ].map((lang)=>(
                    <div key={lang.name}>

                      <div className="flex justify-between text-sm mb-1">
                        <span>{lang.name}</span>
                        <span>{lang.value}%</span>
                      </div>

                      <div className="w-full bg-gray-200 rounded-full h-2">

                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{width:`${lang.value}%`}}
                        />

                      </div>

                    </div>
                  ))}

                </div>

              </div>

            </div>

          </div>

        )}

      </div>

    </div>
  );
}

export default CV;