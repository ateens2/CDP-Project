// src/components/Category.jsx
import React, { useContext, useState } from "react";
import { UserContext } from "../contexts/UserContext";
import { useNavigate } from "react-router-dom";
import "./Category.css";

const Category = () => {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("고객 관리");

  const handleCategoryClick = (category, path) => {
    setActiveCategory(category);
    navigate(path);
  };

  return (
    <div className="sidebar">
      <nav>
        <div className="menu-header">MAIN MENU</div>
        <button
          className={`sidebar-item ${
            activeCategory === "고객 관리" ? "active" : ""
          }`}
          onClick={() =>
            handleCategoryClick("고객 관리", "/customer-management")
          }
        >
          고객 관리
        </button>
        <button
          className={`sidebar-item ${
            activeCategory === "매출 분석" ? "active" : ""
          }`}
          onClick={() => handleCategoryClick("매출 분석", "/data-analytics")}
        >
          매출 분석
        </button>
      </nav>
      <div className="profile">
        <div className="avatar">
          {user && user.displayName ? user.displayName.charAt(0) : "U"}
        </div>
        <div className="profile-info">
          <div className="profile-name">{user ? user.displayName : "User"}</div>
          <div className="profile-role">영업 관리자</div>
        </div>
      </div>
    </div>
  );
};

export default Category;
