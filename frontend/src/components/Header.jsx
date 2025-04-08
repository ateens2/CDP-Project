// src/components/Header.jsx
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import { logoutUser } from "../auth/Logout";
import "./Header.css";

const Header = ({ hideTitle }) => {
  const { user, setUser, setSheets } = useContext(UserContext);
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const handleLogout = async () => {
    const success = await logoutUser(backendUrl);
    if (success) {
      setUser(null);
      setSheets([]);
      navigate("/login");
    }
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
            <span>{user.name} 님</span>
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
