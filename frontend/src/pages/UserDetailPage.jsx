import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./UserDetailPage.css";
import Header from "../components/Header";

export default function UserDetailPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState({});
  const [xpPercent, setXpPercent] = useState(0);
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    fetch(`${backendUrl}/auth/me`, { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          navigate("/login");
          throw new Error("Unauthorized");
        }
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setLoading(false);
        const pct = Math.min(
          (data.user.experience / data.user.experienceToNextLevel) * 100,
          100
        );
        setTimeout(() => setXpPercent(pct), 50);
      })
      .catch((err) => {
        if (err.message !== "Unauthorized") {
          setError(err);
          setLoading(false);
        }
      });
  }, [navigate, backendUrl]);

  const toggleEdit = (field) => {
    setEditMode((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleChange = (field, value) => {
    setUser((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    alert("[UserDetailPage] handleSave_Admin_Audit_Test called!");
    console.log("[UserDetailPage] handleSave_Admin_Audit_Test called. Current user state:", JSON.stringify(user));
    const payload = { name: user.name, phone: user.phone };
    // 만약 sheet_file도 업데이트 대상이라면 payload에 추가:
    // if (user.hasOwnProperty('sheet_file')) { // sheet_file이 user 객체에 있는지 확인 후 추가
    //   payload.sheet_file = user.sheet_file;
    // }
    console.log("[UserDetailPage] Payload to be sent to /auth/updateUser:", JSON.stringify(payload));
    alert("[UserDetailPage] Payload prepared. About to fetch.");

    try {
      const res = await fetch(`${backendUrl}/auth/updateUser`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      console.log("[UserDetailPage] /auth/updateUser response status:", res.status);
      const responseData = await res.json(); // 응답 내용을 먼저 확인
      console.log("[UserDetailPage] /auth/updateUser response data:", JSON.stringify(responseData));

      if (!res.ok) throw new Error(responseData.message || "저장에 실패했습니다.");
      
      // 백엔드가 수정된 user 객체를 반환한다고 가정하고 업데이트 (또는 메시지만 처리)
      // 현재 백엔드는 메시지만 반환하므로, setUser 로직은 user 객체가 올 때만 수행하도록 조건 추가
      if (responseData.user) {
          setUser(responseData.user);
      }
      
      setEditMode({});
      alert(responseData.message || "저장되었습니다."); // 백엔드 메시지 사용
      window.location.reload(); // 저장 후 페이지 새로고침하여 최신 정보 반영
    } catch (err) {
      console.error("[UserDetailPage] Save error:", err);
      alert("[UserDetailPage] Save error: " + err.message);
    }
  };

  if (loading) return <div className="loading">로딩 중...</div>;
  if (error) return <div className="error">오류 발생: {error.message}</div>;

  return (
    <div>
      <Header />
      <div className="user-detail-container">
        {/* 상단 안내 문구 */}
        <div className="header-note">
          어플을 통해 종이를 아낌으로서 환경을 지켜주셔서 감사합니다.
        </div>

        {/* 요약 정보 영역 */}
        <div className="user-overview">
          <div className="overview-row">
            <span className="overview-value">{user.name} 님</span>
          </div>
          <div className="overview-row">
            <span className="overview-label">레벨</span>
            <span className="overview-value badge">Lv. {user.level}</span>
          </div>
          <div className="overview-row xp-row">
            <span className="overview-label">경험치</span>
            <div className="xp-bar-container">
              <div className="xp-bar-bg">
                <div
                  className="xp-bar-fill"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
              <span className="xp-text">
                {user.experience} / {user.experienceToNextLevel}
              </span>
            </div>
          </div>
        </div>

        {/* 기본 정보 헤더 */}
        <div className="user-detail-header">
          <h1 className="user-detail-title">기본 정보</h1>
        </div>

        {/* 콘텐츠 */}
        <div className="user-detail-content">
          <div className="user-detail-item">
            <span className="label">이름</span>
            <div className="value-with-icon">
              {editMode.name ? (
                <input
                  value={user.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  onBlur={() => toggleEdit("name")}
                />
              ) : (
                <span className="value">{user.name}</span>
              )}
              <i
                className="fa-solid fa-pen-to-square edit-icon"
                onClick={() => toggleEdit("name")}
              />
            </div>
          </div>
          <div className="user-detail-item">
            <span className="label">전화번호</span>
            <div className="value-with-icon">
              {editMode.phone ? (
                <input
                  value={user.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  onBlur={() => toggleEdit("phone")}
                />
              ) : (
                <span className="value">{user.phone}</span>
              )}
              <i
                className="fa-solid fa-pen-to-square edit-icon"
                onClick={() => toggleEdit("phone")}
              />
            </div>
          </div>
          <div className="user-detail-item">
            <span className="label">이메일 주소</span>
            <div className="value">
              <input type="email" value={user.email} disabled />
            </div>
            <span className="hint">이메일 주소는 변경할 수 없습니다.</span>
          </div>
          <div className="user-detail-item">
            <span className="label">가입일자</span>
            <div className="value">
              <input
                type="text"
                value={
                  user.created_
                    ? new Date(user.created_).toLocaleDateString()
                    : "-"
                }
                disabled
              />
            </div>
            <span className="hint">가입일자는 변경할 수 없습니다.</span>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="user-detail-actions">
          <button className="save-button" onClick={handleSave}>
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
