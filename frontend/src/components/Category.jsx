// src/components/Category.jsx
import React, { useContext, useState } from "react";
import { UserContext } from "../contexts/UserContext";
import { useNavigate, useLocation } from "react-router-dom";
import CustomToast from "../toast";
import "./Category.css";

const Category = ({ sheet }) => {
  const { user, sheets } = useContext(UserContext);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const defaultCategory = pathname.includes("/customer-management")
    ? "고객 관리"
    : pathname.includes("/data-analytics")
    ? "매출 분석"
    : pathname.includes("/carbon-impact")
    ? "탄소 감축"
    : "";

  const [activeCategory, setActiveCategory] = useState(defaultCategory);

  const handleCategoryClick = (category, path) => {
    setActiveCategory(category);
    // 넘겨받은 sheet가 있으면 그 값을, 없으면 UserContext에서 가져온다
    const sheetToPass =
      sheet || (sheets && sheets.length > 0 ? sheets[0] : null);

    console.log("Category에서 이동 - 전달할 시트:", sheetToPass);

    if (sheetToPass) {
      navigate(path, { state: { sheet: sheetToPass } });
    } else {
      navigate(path);
    }
  };

  return (
    <div className="sidebar">
      <nav>
        <div className="menu-header">
          <i className="fa fa-leaf"></i>
          MAIN MENU
        </div>
        <button
          className={`sidebar-item ${
            activeCategory === "고객 관리" ? "active" : ""
          }`}
          onClick={() => {
            if (!user) {
              console.log("로그인X");
              CustomToast.error("로그인 후 이용해 주세요.", {
                position: "bottom-right",
              });
            } else {
              handleCategoryClick("고객 관리", "/customer-management");
            }
          }}
        >
          <i className="fa fa-users"></i>
          고객 관리
        </button>
        <button
          className={`sidebar-item ${
            activeCategory === "매출 분석" ? "active" : ""
          }`}
          onClick={() => {
            if (!user) {
              CustomToast.error("로그인 후 이용해 주세요.", {
                position: "bottom-right",
              });
            } else {
              handleCategoryClick("매출 분석", "/data-analytics");
            }
          }}
        >
          <i className="fa fa-chart-line"></i>
          매출 분석
        </button>
        <button
          className={`sidebar-item ${
            activeCategory === "탄소 감축" ? "active" : ""
          }`}
          onClick={() => {
            if (!user) {
              CustomToast.error("로그인 후 이용해 주세요.", {
                position: "bottom-right",
              });
            } else {
              handleCategoryClick("탄소 감축", "/carbon-impact");
            }
          }}
        >
          <i className="fa fa-leaf"></i>
          탄소 감축
        </button>
        
        <div className="menu-section-divider"></div>
        
        <div className="menu-subheader">
          <i className="fa fa-cog"></i>
          WORKSPACE
        </div>
        <button
          className={`sidebar-item ${
            pathname === "/" ? "active" : ""
          }`}
          onClick={() => navigate("/")}
        >
          <i className="fa fa-home"></i>
          대시보드
        </button>
        {user && user.role === "admin" && (
          <button
            className={`sidebar-item ${
              pathname === "/audit-log" ? "active" : ""
            }`}
            onClick={() => {
              const sheetToPass = sheet || (sheets && sheets.length > 0 ? sheets[0] : null);
              console.log("감사 로그로 이동 - 전달할 시트:", sheetToPass);
              if (sheetToPass) {
                navigate("/audit-log", { state: { sheet: sheetToPass } });
              } else {
                navigate("/audit-log");
              }
            }}
          >
            <i className="fa fa-history"></i>
            감사 로그
          </button>
        )}
      </nav>
    </div>
  );
};

export default Category;
