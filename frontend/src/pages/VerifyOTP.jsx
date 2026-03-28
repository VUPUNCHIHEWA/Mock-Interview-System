import axios from "axios";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function VerifyOTP() {

  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // countdown timer
  useEffect(() => {

    if (timer > 0) {

      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);

      return () => clearInterval(interval);

    } else {

      setCanResend(true);

    }

  }, [timer]);


  // VERIFY OTP
  const verifyOTP = async () => {

    if (!email) {
      alert("Email not found. Please signup again.");
      navigate("/signup");
      return;
    }

    try {

      const res = await axios.post(
        "http://127.0.0.1:8000/verify-otp",
        {
          email: email,
          otp: otp
        }
      );

      alert(res.data.message);

      navigate("/login");

    } catch (err) {

      alert("Invalid OTP");

    }

  };


  // RESEND OTP
  const resendOTP = async () => {

    try {

      await axios.post(
        "http://127.0.0.1:8000/resend-otp",
        {
          email: email
        }
      );

      alert("New OTP sent!");

      setTimer(30);
      setCanResend(false);

    } catch (err) {

      alert("Failed to resend OTP");

    }

  };


  return (

    <div style={styles.container}>

      <div style={styles.card}>

        <h2 style={styles.title}>Verify OTP</h2>

        <p style={styles.email}>
          OTP sent to <b>{email}</b>
        </p>

        <input
          style={styles.input}
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />

        <button style={styles.button} onClick={verifyOTP}>
          Verify OTP
        </button>


        {canResend ? (

          <button style={styles.resend} onClick={resendOTP}>
            Resend OTP
          </button>

        ) : (

          <p style={styles.timer}>
            Resend OTP in {timer}s
          </p>

        )}

      </div>

    </div>

  );

}

export default VerifyOTP;



const styles = {

  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    background: "#f4f6f9"
  },

  card: {
    background: "white",
    padding: "40px",
    borderRadius: "10px",
    width: "350px",
    textAlign: "center",
    boxShadow: "0 5px 15px rgba(0,0,0,0.1)"
  },

  title: {
    marginBottom: "10px"
  },

  email: {
    fontSize: "14px",
    color: "gray",
    marginBottom: "20px"
  },

  input: {
    width: "100%",
    padding: "10px",
    marginBottom: "15px",
    borderRadius: "5px",
    border: "1px solid #ccc"
  },

  button: {
    width: "100%",
    padding: "10px",
    background: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer"
  },

  resend: {
    marginTop: "15px",
    background: "none",
    border: "none",
    color: "#007bff",
    cursor: "pointer"
  },

  timer: {
    marginTop: "15px",
    color: "gray",
    fontSize: "14px"
  }

};