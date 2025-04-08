// src/App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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

  useEffect(() => {
    fetch(`${backendUrl}/auth/me`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
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
      })
      .catch((error) => {
        console.error("Error fetching session info:", error);
      });
  }, [backendUrl]);

  // gapi가 로드되지 않았거나, 사용자 정보 또는 accessToken이 복원되지 않았다면 로딩 상태 표시
  if (!gapiLoaded) return <div>Loading Google API...</div>;

  return (
    <UserContext.Provider value={{ user, setUser, sheets, setSheets }}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Workspace />} />
        </Routes>
      </Router>
    </UserContext.Provider>
  );
}

export default App;
