// src/components/Header.jsx
import React, { useContext, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import { logoutUser } from "../auth/Logout";
import { loginWithGoogle } from "../auth/Login";
import Category from "./Category";
import "./Header.css";

export default function Header({ hideTitle, sheet }) {
  const { user, setUser, setSheets } = useContext(UserContext);
  const navigate = useNavigate();

  // 유저 드롭다운
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef(null);

  // 햄버거 클릭 시 사이드바 토글
  const [showCategory, setShowCategory] = useState(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  // 클릭 외부 영역 시 메뉴/사이드바 닫기
  useEffect(() => {
    function handleClickOutside(e) {
      // 1) 유저 메뉴 닫기
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(false);
      }

      // 2) 사이드바 바깥 클릭 시 닫기
      if (showCategory) {
        const sidebarEl = document.getElementById("sidebar-container");
        // “햄버거 버튼 내부” 클릭은 닫기 로직에서 제외하기 위해
        const isHamburgerClick = e.target.closest(".hamburger-icon");
        if (sidebarEl && !sidebarEl.contains(e.target) && !isHamburgerClick) {
          setShowCategory(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCategory]);

  // 로그아웃 처리
  const handleLogout = async () => {
    const success = await logoutUser(backendUrl);
    if (success) {
      setUser(null);
      setSheets([]);
      navigate("/login");
    }
  };

  // 프로필 이동
  const goProfile = () => {
    setOpenMenu(false);
    navigate("/profile");
  };

  // 구글 로그인 호출
  const handleGoogleLoginHeader = () => {
    loginWithGoogle(backendUrl);
  };

  return (
    <>
      <header className="Header">
        {/* ── 햄버거 아이콘 ── */}
        <button
          className="hamburger-icon"
          onClick={() => setShowCategory((prev) => !prev)}
        >
          <i className="fa fa-bars"></i>
        </button>

        {/* ── GRM 로고 ── */}
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
                  {user.role === "admin" && (
                    <button
                      onClick={() => {
                        setOpenMenu(false);
                        navigate("/audit-log");
                      }}
                    >
                      감사 로그
                    </button>
                  )}
                  <button onClick={handleLogout}>로그아웃</button>
                </div>
              )}
            </>
          ) : (
            <button className="login-button" onClick={handleGoogleLoginHeader}>
              Login with Google
            </button>
          )}
        </div>
      </header>

      {/* ── 사이드바: 항상 렌더링하되, 클래스만 토글하여 애니메이션 처리 ── */}
      <div id="sidebar-container" className={showCategory ? "open" : ""}>
        <Category sheet={(user, sheet)} />
      </div>
    </>
  );
}
