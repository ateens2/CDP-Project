// src/pages/Signup.jsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { signupUser } from "../auth/Signup";
import "./signup.css";

const Signup = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prepopulatedEmail = location.state?.googleEmail || "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState(prepopulatedEmail);
  const [phone, setPhone] = useState("");
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await signupUser({ name, email, phone }, backendUrl);
      alert(`Signup complete! Welcome, ${data.user.name}`);
      // 회원가입 완료 후 workspace로 이동
      navigate("/");
    } catch (error) {
      console.error("Signup error:", error);
      alert("An error occurred during signup.");
    }
  };

  return (
    <div className="signup-container">
      <header className="signup-header">
        <button className="signup-logo" onClick={() => navigate("/")}>
          GRM
        </button>
      </header>
      <main className="signup-main">
        <div className="signup-box">
          <h2>Create your GRM account</h2>
          <form onSubmit={handleSubmit}>
            <label htmlFor="name">Name:</label>
            <input
              id="name"
              type="text"
              value={name}
              placeholder="Your name"
              onChange={(e) => setName(e.target.value)}
            />
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              type="text"
              value={email}
              placeholder="name@example.com"
              readOnly
            />
            <label htmlFor="phone">Phone:</label>
            <input
              id="phone"
              type="text"
              value={phone}
              placeholder="010-xxxx-xxxx"
              onChange={(e) => setPhone(e.target.value)}
            />
            <button type="submit" className="signup-button">
              Sign up
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Signup;
