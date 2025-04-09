// src/App.jsx
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import useGoogleAuth from "./hooks/UseGoogleAuth";
import { UserContext } from "./contexts/UserContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Workspace from "./pages/Workspace";

function App() {
  const { gapiLoaded } = useGoogleAuth();
  const [user, setUser] = useState(null);
  const [sheets, setSheets] = useState([]);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  if (!gapiLoaded) return <div>Loading Google API...</div>;

  return (
    <Router>
      <UserProvider
        backendUrl={backendUrl}
        user={user}
        setUser={setUser}
        sheets={sheets}
        setSheets={setSheets}
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Workspace />} />
        </Routes>
      </UserProvider>
    </Router>
  );
}

// UserProvider 컴포넌트는 백엔드의 /auth/me 엔드포인트로 세션 정보를 확인합니다.
// 만약 401(로그인 안 됨) 또는 404(사용자 없음)가 반환되면, 로딩을 중단하고 로그인 페이지로 바로 이동하도록 합니다.
function UserProvider({ backendUrl, user, setUser, sheets, setSheets, children }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`${backendUrl}/auth/me`, {
          credentials: "include",
        });
        if (res.status === 401) {
          console.log("Not authenticated: redirecting to login.");
          setLoading(false);
          navigate("/login");
          return;
        } else if (res.status === 404) {
          // 응답에서 googleEmail 값을 읽어옵니다.
          const data = await res.json();
          console.log("User not found in DB: redirecting to signup.");
          setLoading(false);
          // state에 googleEmail 값을 담아 signup 페이지로 전달합니다.
          navigate("/signup", { state: { googleEmail: data.googleEmail } });
          return;
        } else if (!res.ok) {
          throw new Error("Failed to fetch session info");
        }
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          if (data.user.sheet_file) {
            setSheets([{ name: "My Sheet", sheetId: data.user.sheet_file }]);
          }
          if (data.user.accessToken && window.gapi && window.gapi.client) {
            window.gapi.client.setToken({ access_token: data.user.accessToken });
            console.log("GAPI token:", window.gapi.client.getToken());
          }
        }
      } catch (error) {
        console.error("Error fetching session info:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [backendUrl, navigate, setUser, setSheets]);

  if (loading) return <div>Loading session...</div>;
  // 제거한 라인: if (!user) navigate("/")

  return (
    <UserContext.Provider value={{ user, setUser, sheets, setSheets }}>
      {children}
    </UserContext.Provider>
  );
}


export default App;
