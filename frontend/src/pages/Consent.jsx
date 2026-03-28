import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Consent() {

  const [agree, setAgree] = useState(false);
  const navigate = useNavigate();

  const handleAccept = () => {

    if (!agree) {
      alert("Please accept the consent to continue");
      return;
    }

    // Save consent status
    localStorage.setItem("consentAccepted", "true");

    navigate("/dashboard");
  };

  const handleDecline = () => {
    navigate("/");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center px-4">

      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl p-8">

        {/* Title */}
        <div className="flex justify-between items-center mb-4">

          <h2 className="text-xl font-semibold text-gray-800">
            Consent for Data Analysis
          </h2>

        </div>

        {/* Description */}
        <p className="text-gray-600 mb-6">
          To provide you with accurate feedback and personalized insights,
          we need your consent to analyze your interview data.
        </p>

        {/* Consent Box */}
        <div className="bg-gray-100 rounded-xl p-5 mb-6">

          <div className="flex items-start">

            <input
              type="checkbox"
              className="mt-1 mr-3"
              onChange={(e) => setAgree(e.target.checked)}
            />

            <div>

              <p className="font-medium text-gray-800">
                I agree to video, audio, and data analysis for mock interview purposes
              </p>

              <p className="text-sm text-gray-600 mt-2">
                Your data will be used solely for providing interview feedback
                and improving our AI models. We respect your privacy and
                ensure secure handling of your data.
              </p>

            </div>

          </div>

        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-4">

          <button
            onClick={handleDecline}
            className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100"
          >
            Decline
          </button>

          <button
            onClick={handleAccept}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Accept & Continue
          </button>

        </div>

      </div>

    </div>
  );
}

export default Consent;