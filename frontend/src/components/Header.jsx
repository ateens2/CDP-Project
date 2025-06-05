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
  const [isHamburgerActive, setIsHamburgerActive] = useState(false);

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
        // "햄버거 버튼 내부" 클릭은 닫기 로직에서 제외하기 위해
        const isHamburgerClick = e.target.closest(".hamburger-icon");
        if (sidebarEl && !sidebarEl.contains(e.target) && !isHamburgerClick) {
          setShowCategory(false);
          setIsHamburgerActive(false);
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

  // 햄버거 메뉴 토글
  const toggleSidebar = () => {
    setShowCategory((prev) => !prev);
    setIsHamburgerActive((prev) => !prev);
  };

  return (
    <>
      <header className="Header">
        {/* ── 햄버거 아이콘 ── */}
        <button
          className={`hamburger-icon ${isHamburgerActive ? 'active' : ''}`}
          onClick={toggleSidebar}
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>

        {/* ── 로고 이미지 ── */}
        <button className="header-left" onClick={() => navigate("/")}>
          <img 
            src="/Logo.png" 
            alt="GRM Logo" 
            className="logo-image"
          />
        </button>

        {!hideTitle && (
          <div className="header-title">
            <span className="workspace-text">Dashboard</span>
            <span className="workspace-subtitle">Green Resource Management</span>
          </div>
        )}

        <div className="header-right" ref={menuRef}>
          {user ? (
            <>
              <div className="user-info">
                <span className="welcome-text">안녕하세요,</span>
                <span className="user-name">{user.name} 님</span>
              </div>
              <div className="user-avatar" onClick={() => setOpenMenu((o) => !o)}>
                <i className="fa-regular fa-circle-user user-icon" />
              </div>
              {openMenu && (
                <div className="user-menu">
                  <div className="menu-header">
                    <span className="menu-user-name">{user.name}</span>
                    <span className="menu-user-email">{user.email}</span>
                  </div>
                  <div className="menu-divider"></div>
                  <button onClick={goProfile}>
                    <i className="fa fa-user"></i>
                    내 정보
                  </button>
                  {user.role === "admin" && (
                    <button
                      onClick={() => {
                        setOpenMenu(false);
                        navigate("/audit-log");
                      }}
                    >
                      <i className="fa fa-history"></i>
                      감사 로그
                    </button>
                  )}
                  <button onClick={handleLogout} className="logout-btn">
                    <i className="fa fa-sign-out-alt"></i>
                    로그아웃
                  </button>
                </div>
              )}
            </>
          ) : (
            <button className="login-button" onClick={handleGoogleLoginHeader}>
              <i className="fab fa-google"></i>
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
