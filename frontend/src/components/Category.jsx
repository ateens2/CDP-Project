// src/components/Category.jsx
import React, { useContext, useState } from "react";
import { UserContext } from "../contexts/UserContext";
import { useNavigate, useLocation } from "react-router-dom";
import "./Category.css";

const Category = ({ sheet }) => {
  const { user, sheets } = useContext(UserContext);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const defaultCategory = pathname.includes("/customer-management")
    ? "고객 관리"
    : pathname.includes("/data-analytics")
    ? "매출 분석"
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
    </div>
  );
};

export default Category;
