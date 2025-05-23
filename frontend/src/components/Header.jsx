import { useContext, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import { logoutUser } from "../auth/Logout";
import { loginWithGoogle } from "../auth/Login"; // 구글 로그인 함수 import
import "./Header.css";

export default function Header({ hideTitle }) {
  const { user, setUser, setSheets } = useContext(UserContext);
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef(null);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  // 클릭 외부 영역 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const success = await logoutUser(backendUrl);
    if (success) {
      setUser(null);
      setSheets([]);
      navigate("/login");
    }
  };

  const goProfile = () => {
    setOpenMenu(false);
    navigate("/profile");
  };

  const handleGoogleLoginHeader = () => {
    // 헤더에서 로그인 버튼 클릭 시 구글 로그인 호출
    loginWithGoogle(backendUrl);
  };

  return (
    <header className="Header">
      <button className="header-left" onClick={() => navigate("/")}>
        GRM
      </button>
      {!hideTitle && <div className="header-title">Work Space</div>}
      <div className="header-right" ref={menuRef}>
        {user ? (
          <>
            <span className="user-name">{user.name} 님</span>
            <i
              className="fa-regular fa-circle-user user-icon"
              onClick={() => setOpenMenu((o) => !o)}
            />
            {openMenu && (
              <div className="user-menu">
                <button onClick={goProfile}>내 정보</button>
                {user && user.role === 'admin' && (
                  <button onClick={() => { setOpenMenu(false); navigate("/audit-log"); }}>감사 로그</button>
                )}
                <button onClick={handleLogout}>로그아웃</button>
              </div>
            )}
          </>
        ) : (
          // 로그인 상태가 아닐 때 구글 로그인 함수 호출
          <button className="login-button" onClick={handleGoogleLoginHeader}>
            Login with Google
          </button>
        )}
      </div>
    </header>
  );
}
