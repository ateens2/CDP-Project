// src/pages/Signup.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignupUser } from "../auth/Signup.js";
import Header from "../components/Header";
import "./signup.css";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailValid, setEmailValid] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [agree, setAgree] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (value) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value);
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    setEmailValid(validateEmail(value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emailValid) {
      alert("이메일 형식이 올바르지 않습니다.");
      return;
    }
    if (password !== passwordConfirm) {
      alert("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!agree) {
      alert("약관에 동의해야 회원가입이 가능합니다.");
      return;
    }
    try {
      const data = await SignupUser({ name, email, password, phone });
      alert(`Signup complete! Welcome, ${data.user.name}`);
      navigate("/login");
    } catch (error) {
      console.error("Signup error:", error);
      alert(error.message || "An error occurred during signup.");
    }
  };

  return (
    <div className="signup-container">
      <Header hideTitle={true} />
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
              onChange={handleEmailChange}
              className={!emailValid ? "error-border" : ""}
            />
            {!emailValid && (
              <div className="error-text">이메일을 입력해주세요</div>
            )}
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              type="password"
              value={password}
              placeholder="12 characters minimum"
              onChange={(e) => setPassword(e.target.value)}
            />
            <label htmlFor="passwordConfirm">Password confirmation:</label>
            <input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              placeholder="Confirm your password"
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
            <label htmlFor="phone">Phone:</label>
            <input
              id="phone"
              type="text"
              value={phone}
              placeholder="010-xxxx-xxxx"
              onChange={(e) => setPhone(e.target.value)}
            />
            <div className="terms-container">
              <input
                id="agree"
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <label htmlFor="agree">
                I acknowledge that I have read, understood, and agreed to the
                Terms of Service and Privacy Policy.
              </label>
            </div>
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
