// src/components/CustomerEditer.jsx
import React, { useState } from "react";
import "./CustomerEditer.css";

const CustomerEditer = ({ customer, onChange, onClose, onSave }) => {
  // 탭 상태: "overview", "orders", "inquiries"
  const [selectedTab, setSelectedTab] = useState("overview");

  if (!customer) {
    return <div>고객 정보가 없습니다.</div>;
  }

  // 기본 정보: 키 이름은 시트 데이터에 따라 다를 수 있으므로, 여기서는 예시로 사용합니다.
  const customerName = customer["고객명"] || customer.name || "이름 없음";
  const customerEmail =
    customer["이메일 주소"] || customer.email || "이메일 없음";
  const customerPhone =
    customer["휴대폰번호"] || customer.phone || "전화번호 없음";

  return (
    <div className="customer-editer-container">
      {/* 상단 고객 기본 정보 영역 */}
      <div className="customer-editer-header">
        <div className="customer-avatar">
          {customerName.charAt(0).toUpperCase()}
        </div>
        <div className="customer-basic-info">
          <h2 className="customer-name">{customerName}</h2>
          <div className="customer-contact">
            <span>{customerPhone}</span> | <span>{customerEmail}</span>
          </div>
        </div>
      </div>

      {/* 탭 버튼 영역 */}
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

      {/* 탭 콘텐츠 영역 */}
      <div className="tab-content">
        {selectedTab === "overview" && (
          <div className="tab-panel">
            <h3>고객개요</h3>
            {/* 예시: 추가 고객 기본정보 입력란 */}
            <div className="field">
              <label>고객명:</label>
              <input
                type="text"
                value={customer["고객명"] || ""}
                onChange={(e) => onChange("고객명", e.target.value)}
              />
            </div>
            <div className="field">
              <label>이메일 주소:</label>
              <input
                type="text"
                value={customer["이메일 주소"] || ""}
                onChange={(e) => onChange("이메일 주소", e.target.value)}
              />
            </div>
            <div className="field">
              <label>휴대폰번호호:</label>
              <input
                type="text"
                value={customer["휴대폰번호"] || ""}
                onChange={(e) => onChange("휴대폰번호", e.target.value)}
              />
            </div>
            <div className="field">
              <label>가입 날짜:</label>
              <input
                type="text"
                value={customer["가입 날짜"] || ""}
                onChange={(e) => onChange("가입 날짜", e.target.value)}
              />
            </div>
            <div className="field">
              <label>주소:</label>
              <input
                type="text"
                value={customer["배송지 주소"] || ""}
                onChange={(e) => onChange("주소", e.target.value)}
              />
            </div>
            {/* 추가로 필요한 정보를 여기에 넣으면 됩니다 */}
          </div>
        )}

        {selectedTab === "orders" && (
          <div className="tab-panel">
            <h3>주문상태</h3>
            <div className="field">
              <label>주문번호:</label>
              <input
                type="text"
                value={customer["주문번호"] || ""}
                onChange={(e) => onChange("주문번호", e.target.value)}
              />
            </div>
            <div className="field">
              <label>주문일자:</label>
              <input
                type="text"
                value={customer["주문일자"] || ""}
                onChange={(e) => onChange("주문일자", e.target.value)}
              />
            </div>
            <div className="field">
              <label>결제 상태:</label>
              <input
                type="text"
                value={customer["결제 상태"] || ""}
                onChange={(e) => onChange("결제 상태", e.target.value)}
              />
            </div>
            <div className="field">
              <label>총 결제 금액:</label>
              <input
                type="text"
                value={customer["총 결제금액"] || ""}
                onChange={(e) => onChange("총 결제금액", e.target.value)}
              />
            </div>
            <div className="field">
              <label>결제 수단:</label>
              <input
                type="text"
                value={customer["결제 수단"] || ""}
                onChange={(e) => onChange("결제 수단", e.target.value)}
              />
            </div>
            <div className="field">
              <label>제품 코드:</label>
              <input
                type="text"
                value={customer["제품 코드"] || ""}
                onChange={(e) => onChange("제품 코드", e.target.value)}
              />
            </div>
            {/* 추가 주문 관련 필드 */}
          </div>
        )}

        {selectedTab === "inquiries" && (
          <div className="tab-panel">
            <h3>문의내용</h3>
            <div className="field">
              <label>문의 번호:</label>
              <input
                type="text"
                value={customer["문의번호"] || ""}
                onChange={(e) => onChange("문의번호", e.target.value)}
              />
            </div>
            <div className="field">
              <label>이슈 유형:</label>
              <input
                type="text"
                value={customer["이슈 유형"] || ""}
                onChange={(e) => onChange("이슈 유형", e.target.value)}
              />
            </div>
            <div className="field">
              <label>문의 접수일:</label>
              <input
                type="text"
                value={customer["문의일자"] || ""}
                onChange={(e) => onChange("문의일자", e.target.value)}
              />
            </div>
            <div className="field">
              <label>처리 일자:</label>
              <input
                type="text"
                value={customer["처리일자"] || ""}
                onChange={(e) => onChange("처리일자", e.target.value)}
              />
            </div>
            <div className="field">
              <label>진행상태:</label>
              <input
                type="text"
                value={customer["진행상태"] || ""}
                onChange={(e) => onChange("진행상태", e.target.value)}
              />
            </div>
            {/* 추가 문의 관련 필드 */}
          </div>
        )}
      </div>

      {/* 저장 버튼 영역 */}
      <div className="customer-editer-actions">
        <button className="panel-save-button" onClick={onSave}>
          저장
        </button>
      </div>
    </div>
  );
};

export default CustomerEditer;
