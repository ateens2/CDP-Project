// src/components/CustomerEditer.jsx
import React, { useState, useEffect, useRef } from "react";
import "./CustomerEditer.css";

const overviewFields = [
  "고객명",
  "이메일 주소",
  "휴대폰번호",
  "가입 날짜",
  "배송지 주소",
];
const orderTextFields = ["주문번호", "주문일자", "총 결제금액", "제품 코드"];
const inquiryTextFields = ["문의번호", "문의일자", "처리일자"];

const CustomerEditer = ({
  customer,
  options: { paymentStatuses, paymentMethods, issueTypes, progressStatuses },
  onChange,
  onSave,
  onDelete,
}) => {
  // State and refs
  const [selectedTab, setSelectedTab] = useState("overview");
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
      [...overviewFields, ...orderTextFields, ...inquiryTextFields].forEach(
        (f) => {
          modes[f] = true;
        }
      );
      setEditMode(modes);
    }
  }, [customer, editMode]);

  // Ensure hooks at top-level
  if (!customer) return <div>고객 정보가 없습니다.</div>;

  const toggleEdit = (field) => {
    setEditMode((prev) => ({ ...prev, [field]: true }));
  };

  const renderTextField = (field) => (
    <div className="field" key={field}>
      <label>{field}:</label>
      <div className="field-with-icon">
        <input
          type="text"
          value={customer[field] || ""}
          readOnly={customer.__rowNum__ != null ? !editMode[field] : false}
          ref={(el) => (inputRefs.current[field] = el)}
          onChange={(e) => onChange(field, e.target.value)}
          onBlur={() => {
            if (customer.__rowNum__ != null) {
              setEditMode((prev) => ({ ...prev, [field]: false }));
            }
          }}
        />
        <i
          className="fa-solid fa-pen-to-square edit-icon"
          onClick={() => toggleEdit(field)}
        />
      </div>
    </div>
  );

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
            <span>{customer["휴대폰번호"]}</span> |{" "}
            <span>{customer["이메일 주소"]}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-buttons">
        <button
          className={selectedTab === "overview" ? "active" : ""}
          onClick={() => setSelectedTab("overview")}
        >
          고객개요
        </button>
        <button
          className={selectedTab === "orders" ? "active" : ""}
          onClick={() => setSelectedTab("orders")}
        >
          주문상태
        </button>
        <button
          className={selectedTab === "inquiries" ? "active" : ""}
          onClick={() => setSelectedTab("inquiries")}
        >
          문의내용
        </button>
      </div>

      {/* Content */}
      <div className="tab-content">
        {selectedTab === "overview" && (
          <div className="tab-panel">
            <h3>고객개요</h3>
            {overviewFields.map((f) => renderTextField(f))}
          </div>
        )}

        {selectedTab === "orders" && (
          <div className="tab-panel">
            <h3>주문상태</h3>
            {orderTextFields.map((f) => renderTextField(f))}
            <div className="field">
              <label>결제 상태:</label>
              <select
                value={customer["결제 상태"] || ""}
                onChange={(e) => onChange("결제 상태", e.target.value)}
              >
                <option value="">--선택--</option>
                {paymentStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>결제 수단:</label>
              <select
                value={customer["결제 수단"] || ""}
                onChange={(e) => onChange("결제 수단", e.target.value)}
              >
                <option value="">--선택--</option>
                {paymentMethods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {selectedTab === "inquiries" && (
          <div className="tab-panel">
            <h3>문의내용</h3>
            {inquiryTextFields.map((f) => renderTextField(f))}
            <div className="field">
              <label>이슈 유형:</label>
              <select
                value={customer["이슈 유형"] || ""}
                onChange={(e) => onChange("이슈 유형", e.target.value)}
              >
                <option value="">--선택--</option>
                {issueTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>진행상태:</label>
              <select
                value={customer["진행상태"] || ""}
                onChange={(e) => onChange("진행상태", e.target.value)}
              >
                <option value="">--선택--</option>
                {progressStatuses.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" key="문의 상세 내용">
              <label>문의 상세 내용:</label>
              <div className="field-with-icon">
                <textarea
                  value={customer["문의 상세 내용"] || ""}
                  readOnly={
                    customer.__rowNum__ != null
                      ? !editMode["문의 상세 내용"]
                      : false
                  }
                  ref={(el) => (inputRefs.current["문의 상세 내용"] = el)}
                  onChange={(e) => onChange("문의 상세 내용", e.target.value)}
                  onBlur={() => {
                    if (customer.__rowNum__ != null) {
                      setEditMode((prev) => ({
                        ...prev,
                        ["문의 상세 내용"]: false,
                      }));
                    }
                  }}
                />
                <i
                  className="fa-solid fa-pen-to-square edit-icon"
                  onClick={() => toggleEdit("문의 상세 내용")}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="customer-editer-actions">
        <button className="panel-save-button" onClick={onSave}>
          저장
        </button>
        <button className="panel-delete-button" onClick={onDelete}>
          삭제
        </button>
      </div>
    </div>
  );
};

export default CustomerEditer;
