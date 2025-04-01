// src/pages/Login.jsx
import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import { LoginUser } from "../auth/login";
import Header from "../components/Header";
import "./login.css";

const USE_MOCK_DATA = false;

const Login = () => {
  const navigate = useNavigate();
  const { setUser, setSheets } = useContext(UserContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    if (USE_MOCK_DATA) {
      const fakeUser = { email: email || "TestUser" };
      const fakeSheets = [];
      setUser(fakeUser);
      setSheets(fakeSheets);
      navigate("/");
    } else {
      try {
        const data = await LoginUser({ email, password });
        // data가 { user: {...}, sheets: [...] } 형태라고 가정
        setUser(data.user);
        setSheets(data.sheets);
        navigate("/");
      } catch (error) {
        console.error("Login error:", error);
        alert(error.message || "An error occurred during login.");
      }
    }
  };

  return (
    <div className="login-container">
      <Header hideTitle={true} />
      <main className="login-main">
        <div className="login-box">
          <div className="login-icon"></div>
          <h2>Log in to your account</h2>
          <form onSubmit={handleLogin} className="login-form">
            <label htmlFor="login-name">Email</label>
            <input
              id="login-name"
              type="text"
              value={email}
              placeholder="Your email"
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="login-options">
              <div className="remember-me">
                <input id="remember" type="checkbox" />
                <label htmlFor="remember">Remember me</label>
              </div>
              <a href="#forgot">Forgot your password?</a>
            </div>
            <button type="submit" className="login-button">
              Sign in
            </button>
          </form>
          <div className="login-footer">
            <p>
              Are you new here? <Link to="/Signup">Signup</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
