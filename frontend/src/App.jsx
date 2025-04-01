// src/App.jsx
import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { UserContext } from "./contexts/UserContext";
import Header from "./components/Header";
import Login from "./pages/Login";
import Workspace from "./pages/Workspace";
import Signup from "./pages/Signup";
function App() {
  // 로그인된 사용자 정보 (예: { name: "홍길동" })
  const [user, setUser] = useState(null);

  // 사용자별 시트 정보 (배열)
  const [sheets, setSheets] = useState([]);

  return (
    <UserContext.Provider value={{ user, setUser, sheets, setSheets }}>
      <Router>
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/Signup" element={<Signup />} />
        </Routes>
      </Router>
    </UserContext.Provider>
  );
}

export default App;
