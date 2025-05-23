// src/pages/Login.jsx
import { useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import Header from "../components/Header";
import { loginWithGoogle } from "../auth/Login";
import "./login.css";

const Login = () => {
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_BACKEND_URL; // 예: http://localhost:3000

  const handleGoogleLogin = () => {
    loginWithGoogle(backendUrl);
  };

  return (
    <div className="login-container">
      <Header hideTitle={true} />
      <main className="login-main">
        <div className="login-box">
          <div className="login-icon"></div>
          <h2>Signup with Google</h2>
          <button className="login-button" onClick={handleGoogleLogin}>
            Signup with Google
          </button>
        </div>
      </main>
    </div>
  );
};

export default Login;
