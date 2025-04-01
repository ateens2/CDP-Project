// src/components/Header.jsx
import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import { LogoutUser } from "../auth/Logout";
import "./Header.css";

const Header = ({ hideTitle }) => {
  const { user, setUser, setSheets } = useContext(UserContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await LogoutUser(); // 백엔드 로그아웃 API 호출
    setUser(null);
    setSheets([]);
    navigate("/");
  };

  return (
    <header className="Header">
      <button className="header-left" onClick={() => navigate("/")}>
        GRM
      </button>
      {!hideTitle && <div className="header-title">Work Space</div>}
      <div className="header-right">
        {user ? (
          <>
            <span>{user.email}</span>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <button className="login-button" onClick={() => navigate("/login")}>
            Login
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
