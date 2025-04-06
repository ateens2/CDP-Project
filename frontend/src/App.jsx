// src/App.jsx
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import useGoogleAuth from "./hooks/UseGoogleAuth";
import { UserContext } from "./contexts/UserContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Workspace from "./pages/Workspace";

function App() {
  const { gapiLoaded, isSignedIn, signIn, signOut } = useGoogleAuth();
  const [user, setUser] = useState(null);
  const [sheets, setSheets] = useState([]);

  if (!gapiLoaded) return <div>Loading Google API...</div>;

  return (
    <UserContext.Provider value={{ user, setUser, sheets, setSheets }}>
      <Router>
        <Routes>
          <Route
            path="/login"
            element={<Login signIn={signIn} isSignedIn={isSignedIn} />}
          />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Workspace />} />
        </Routes>
      </Router>
    </UserContext.Provider>
  );
}

export default App;
