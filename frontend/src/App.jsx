// src/App.jsx
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
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
  // 더미 사용자 자동 로그인
  const [user, setUser] = useState({
    id: 'dummy_user_001',
    name: '테스트 사용자',
    email: 'test@example.com', 
    role: 'admin'
  });
  
  // XLSX 파일 정보 설정
  const [excelFile, setExcelFile] = useState({
    name: 'GRM_주문_데이터.xlsx',
    path: 'data/GRM_주문_데이터.xlsx',
    type: 'xlsx'
  });

  // 하위 호환성을 위한 sheets 접근자 제공
  const sheets = [{ name: excelFile.name, sheetId: 'xlsx-file' }];
  const setSheets = () => {}; // no-op

  return (
    <Router>
      <UserProvider
        user={user}
        setUser={setUser}
        excelFile={excelFile}
        setExcelFile={setExcelFile}
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
          <Route path="/" element={<Workspace />} />
        </Routes>
      </UserProvider>
    </Router>
  );
}

function UserProvider({
  user,
  setUser,
  excelFile,
  setExcelFile,
  sheets,
  setSheets,
  children,
}) {
  console.log('더미 사용자 자동 로그인:', user);
  console.log('XLSX 파일 설정:', excelFile);

  return (
    <UserContext.Provider 
      value={{ 
        user, 
        setUser, 
        excelFile, 
        setExcelFile,
        sheets, // 하위 호환성
        setSheets // 하위 호환성
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export default App;