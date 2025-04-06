// src/pages/Login.jsx
import { useState, useContext, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import Header from "../components/Header";
import "./login.css";

// 플래그: true이면 mock data 사용, false이면 실제 API 호출(이 경우 Google 로그인 사용)
const USE_MOCK_DATA = false;

const Login = ({ signIn, isSignedIn }) => {
  const navigate = useNavigate();
  const { setUser, setSheets } = useContext(UserContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 인증 상태가 변하면 navigate 처리
  useEffect(() => {
    if (isSignedIn) {
      // 실제로는 로그인 후 사용자 정보를 받아와 setUser()로 저장하는 로직이 필요합니다.
      setUser({ email: email || "GoogleUser" });
      setSheets([]);
      navigate("/");
    }
  }, [isSignedIn, navigate, email, setUser, setSheets]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (USE_MOCK_DATA) {
      const fakeUser = { email: email || "TestUser" };
      setUser(fakeUser);
      setSheets([]);
      navigate("/");
    } else {
      signIn();
      console.log(isSignedIn);
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
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
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
          <div className="google-login">
            <button className="login-button" onClick={handleLogin}>
              Google 로그인하기
            </button>
          </div>
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
