// src/components/CustomerEditer.jsx
import React, { useState, useEffect, useRef } from "react";
import "./CustomerEditer.css";

// 고객_정보 시트 필드 정의
const basicInfoFields = [
  "고객ID",
  "고객명", 
  "연락처",
  "이메일",
  "가입일"
];

const purchaseStatsFields = [
  "마지막_구매일",
  "총_구매_금액", 
  "총_구매_횟수"
];

const carbonFields = [
  "탄소_감축_등급",
  "탄소_감축_점수"
];

const CustomerEditer = ({
  customer,
  onChange,
  onSave,
  onDelete,
}) => {
  // State and refs
  const [selectedTab, setSelectedTab] = useState("basic");
  const [editMode, setEditMode] = useState({});
  const inputRefs = useRef({});

  // Focus input when a field enters edit mode
  useEffect(() => {
    Object.entries(editMode).forEach(([field, mode]) => {
      if (mode && inputRefs.current[field]) {
        inputRefs.current[field].focus();
      }
    });
  }, [editMode]);

  // On first encounter of a new customer only, enable all text fields
  useEffect(() => {
    if (customer.__rowNum__ == null && Object.keys(editMode).length === 0) {
      const modes = {};
      basicInfoFields.forEach((f) => {
        modes[f] = true;
      });
      setEditMode(modes);
    }
  }, [customer, editMode]);

  // Ensure hooks at top-level
  if (!customer) return <div>고객 정보가 없습니다.</div>;

  const toggleEdit = (field) => {
    setEditMode((prev) => ({ ...prev, [field]: true }));
  };

  const renderTextField = (field, isReadOnly = false) => {
    const fieldLabels = {
      "고객ID": "고객 ID",
      "고객명": "고객명",
      "연락처": "연락처", 
      "이메일": "이메일",
      "가입일": "가입일",
      "마지막_구매일": "마지막 구매일",
      "총_구매_금액": "총 구매 금액",
      "총_구매_횟수": "총 구매 횟수",
      "탄소_감축_등급": "탄소 감축 등급",
      "탄소_감축_점수": "탄소 감축 점수"
    };

    return (
      <div className="field" key={field}>
        <label>{fieldLabels[field] || field}:</label>
        <div className="field-with-icon">
          <input
            type="text"
            value={customer[field] || ""}
            readOnly={isReadOnly || (customer.__rowNum__ != null ? !editMode[field] : false)}
            ref={(el) => (inputRefs.current[field] = el)}
            onChange={(e) => onChange(field, e.target.value)}
            onBlur={() => {
              if (customer.__rowNum__ != null) {
                setEditMode((prev) => ({ ...prev, [field]: false }));
              }
            }}
            className={isReadOnly ? "readonly" : ""}
          />
          {!isReadOnly && (
            <i
              className="fa-solid fa-pen-to-square edit-icon"
              onClick={() => toggleEdit(field)}
            />
          )}
        </div>
      </div>
    );
  };

  const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return `₩${num.toLocaleString()}`;
  };

  const getCarbonGradeColor = (grade) => {
    const colors = {
      'Stone': '#6c757d',
      'Bronze': '#cd7f32', 
      'Silver': '#c0c0c0',
      'Gold': '#ffd700',
      'Platinum': '#4a90e2',
      'Diamond': '#b9f2ff'
    };
    return colors[grade] || '#f8f9fa';
  };

  return (
    <div className="customer-editer-container">
      {/* Header */}
      <div className="customer-editer-header">
        <div className="customer-avatar">
          {(customer["고객명"] || "").charAt(0).toUpperCase()}
        </div>
        <div className="customer-basic-info">
          <h2 className="customer-name">{customer["고객명"] || "이름 없음"}</h2>
          <div className="customer-contact">
            <span>{customer["연락처"]}</span> |{" "}
            <span>{customer["이메일"]}</span>
          </div>
          <div className="customer-carbon-info">
            <span 
              className="carbon-grade-badge"
              style={{ backgroundColor: getCarbonGradeColor(customer["탄소_감축_등급"]) }}
            >
              {customer["탄소_감축_등급"] || "등급없음"}
            </span>
            <span className="carbon-score">
              {Number(customer["탄소_감축_점수"] || 0).toFixed(1)}점
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-buttons">
        <button
          className={selectedTab === "basic" ? "active" : ""}
          onClick={() => setSelectedTab("basic")}
        >
          기본정보
        </button>
        <button
          className={selectedTab === "purchase" ? "active" : ""}
          onClick={() => setSelectedTab("purchase")}
        >
          구매통계
        </button>
        <button
          className={selectedTab === "carbon" ? "active" : ""}
          onClick={() => setSelectedTab("carbon")}
        >
          탄소감축
        </button>
      </div>

      {/* Content */}
      <div className="tab-content">
        {selectedTab === "basic" && (
          <div className="tab-panel">
            <h3>기본정보</h3>
            {basicInfoFields.map((f) => renderTextField(f))}
          </div>
        )}

        {selectedTab === "purchase" && (
          <div className="tab-panel">
            <h3>구매통계</h3>
            <div className="stats-overview">
              <div className="stat-card">
                <div className="stat-label">총 구매 금액</div>
                <div className="stat-value">
                  {formatCurrency(customer["총_구매_금액"])}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">총 구매 횟수</div>
                <div className="stat-value">
                  {customer["총_구매_횟수"] || 0}회
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">마지막 구매일</div>
                <div className="stat-value">
                  {customer["마지막_구매일"] || "구매 기록 없음"}
                </div>
              </div>
            </div>
            <div className="field-group">
              {purchaseStatsFields.map((f) => renderTextField(f, true))}
            </div>
            <p className="info-text">
              * 구매통계는 제품 판매 기록을 기반으로 자동 계산됩니다.
            </p>
          </div>
        )}

        {selectedTab === "carbon" && (
          <div className="tab-panel">
            <h3>탄소감축 정보</h3>
            <div className="carbon-overview">
              <div className="carbon-grade-display">
                <div className="grade-label">현재 등급</div>
                <div 
                  className="grade-badge-large"
                  style={{ backgroundColor: getCarbonGradeColor(customer["탄소_감축_등급"]) }}
                >
                  {customer["탄소_감축_등급"] || "등급없음"}
                </div>
              </div>
              <div className="carbon-score-display">
                <div className="score-label">탄소 감축 점수</div>
                <div className="score-value">
                  {Number(customer["탄소_감축_점수"] || 0).toFixed(1)}
                </div>
              </div>
            </div>
            <div className="field-group">
              {carbonFields.map((f) => renderTextField(f, true))}
            </div>
            <div className="grade-info">
              <h4>등급 기준</h4>
              <ul>
                <li><span className="grade-item stone">Stone</span>: 0점 이하</li>
                <li><span className="grade-item bronze">Bronze</span>: 1~199점</li>
                <li><span className="grade-item silver">Silver</span>: 200~499점</li>
                <li><span className="grade-item gold">Gold</span>: 500~999점</li>
                <li><span className="grade-item platinum">Platinum</span>: 1000~2999점</li>
                <li><span className="grade-item diamond">Diamond</span>: 3000점 이상</li>
              </ul>
            </div>
            <p className="info-text">
              * 탄소 감축 정보는 구매한 제품의 환경 기여도를 기반으로 자동 계산됩니다.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="customer-editer-actions">
        <button className="btn-save" onClick={onSave}>
          저장
        </button>
        {customer.__rowNum__ != null && (
          <button className="btn-delete" onClick={onDelete}>
            삭제
          </button>
        )}
      </div>
    </div>
  );
};

export default CustomerEditer;
