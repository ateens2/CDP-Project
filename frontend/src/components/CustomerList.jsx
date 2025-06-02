// src/components/CustomerList.jsx
import React from "react";
import "./CustomerList.css";

const CustomerList = ({
  customers,
  totalCount,
  selectedCustomer,
  onSelectCustomer,
}) => {
  return (
    <div className="customer-list-container">
      <h2 className="customer-list-title">
        고객 목록 <span className="customer-count">(총 {totalCount}명)</span>
      </h2>
      <div className="customer-list-header">
        <span className="header-item">고객명</span>
        <span className="header-item">연락처</span>
        <span className="header-item">이메일</span>
        <span className="header-item">총 구매금액</span>
        <span className="header-item">구매횟수</span>
        <span className="header-item">탄소등급</span>
      </div>
      <ul className="customer-list-ul" title="상세정보 보기">
        {customers.map((customer, index) => {
          const customerId = customer["고객ID"] || "";
          const customerName = customer["고객명"] || "";
          const email = customer["이메일"] || "";
          const contact = customer["연락처"] || "";
          const totalAmount = customer["총_구매_금액"] || "0";
          const totalCount = customer["총_구매_횟수"] || "0";
          const carbonGrade = customer["탄소_감축_등급"] || "";
          const carbonScore = customer["탄소_감축_점수"] || "0";
          
          return (
            <li
              key={customerId || index}
              className={`customer-list-item ${
                selectedCustomer &&
                selectedCustomer["고객ID"] === customer["고객ID"]
                  ? "selected"
                  : ""
              }`}
              onClick={() => onSelectCustomer(customer)}
            >
              <span className="customer-field customer-name">
                {customerName}
              </span>
              <span className="customer-field customer-contact">{contact}</span>
              <span className="customer-field customer-email">{email}</span>
              <span className="customer-field customer-total-amount">
                ₩{Number(totalAmount).toLocaleString()}
              </span>
              <span className="customer-field customer-total-count">
                {totalCount}회
              </span>
              <span className={`customer-field customer-carbon-grade grade-${carbonGrade.toLowerCase()}`}>
                {carbonGrade}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CustomerList;
