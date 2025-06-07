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
import SheetEditor from "./components/SheetEditor";
import InitialPage from "./pages/InitialPage";
import CustomerManagement from "./pages/CustomerManagement";
import DataAnalytics from "./pages/DataAnalytics";
import UserDetailPage from "./pages/UserDetailPage";
import AuditLogPage from "./pages/AuditLogPage";
import CarbonImpactDashboard from "./pages/CarbonImpactDashboard";

function App() {
  const { gapiLoaded } = useGoogleAuth();
  const [user, setUser] = useState(null);
  const [sheets, setSheets] = useState([]);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  if (!gapiLoaded) {
    return (
      <div className="loading-message">
        <i className="fas fa-spinner fa-spin"></i>
        <p>로딩중...</p>
      </div>
    );
  }

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
          <Route path="/sheet-editor" element={<SheetEditor />} />
          <Route path="/customer-management" element={<CustomerManagement />} />
          <Route path="/data-analytics" element={<DataAnalytics />} />
          <Route path="/carbon-impact" element={<CarbonImpactDashboard />} />
          <Route path="/profile" element={<UserDetailPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="/" element={user ? <Workspace /> : <InitialPage />} />
        </Routes>
      </UserProvider>
    </Router>
  );
}

function UserProvider({
  backendUrl,
  user,
  setUser,
  sheets,
  setSheets,
  children,
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`${backendUrl}/auth/me`, {
          credentials: "include",
        });
        if (res.status === 401) {
          console.log("Not authenticated: user remains null.");
          setLoading(false);
          return;
        } else if (res.status === 404) {
          const data = await res.json();
          console.log("User not found in DB: redirecting to signup.");
          setLoading(false);
          navigate("/signup", { state: { googleEmail: data.googleEmail } });
          return;
        } else if (!res.ok) {
          throw new Error("Failed to fetch session info");
        }
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          if (data.user.sheet_file) {
            setSheets([]);
          }
          if (data.user.accessToken && window.gapi && window.gapi.client) {
            window.gapi.client.setToken({
              access_token: data.user.accessToken,
            });
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

  if (loading) {
    return (
      <div className="loading-message">
        <i className="fas fa-spinner fa-spin"></i>
        <p>로딩중...</p>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, setUser, sheets, setSheets }}>
      {children}
    </UserContext.Provider>
  );
}

export default App;