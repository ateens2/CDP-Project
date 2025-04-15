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
      <ul className="customer-list-ul">
        {customers.map((customer, index) => {
          // 키 처리: 만약 sheet 헤더가 "고객 이름" 대신 다른 값이면, 대체로 customer.name 등을 사용
          const customerName = customer["고객명"] || customer.name || "";
          const email = customer["이메일 주소"] || customer.email || "";
          const contact = customer["연락처"] || customer.contact || "";
          const orderStatus =
            customer["결제 상태"] || customer.order_status || "";
          return (
            <li
              key={index}
              className={`customer-list-item ${
                selectedCustomer &&
                ((selectedCustomer["고객 고유 번호"] &&
                  selectedCustomer["고객 고유 번호"] ===
                    customer["고객 고유 번호"]) ||
                  (selectedCustomer.id && selectedCustomer.id === customer.id))
                  ? "selected"
                  : ""
              }`}
              onClick={() => onSelectCustomer(customer)}
            >
              <span className="customer-field customer-name">
                {customerName}
              </span>
              <span className="customer-field customer-email">{email}</span>
              <span className="customer-field customer-contact">{contact}</span>
              <span className="customer-field customer-order-status">
                {orderStatus}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CustomerList;
