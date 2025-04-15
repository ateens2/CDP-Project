// src/pages/CustomerManagement.jsx
import React, { useState, useEffect, useContext, useRef } from "react";
import { useLocation } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import Header from "../components/Header";
import Category from "../components/Category";
import CustomerList from "../components/CustomerList";
import CustomerEditer from "../components/CustomerEditer";
import "./CustomerManagement.css";

const CustomerManagement = () => {
  const { state } = useLocation();
  const sheet = state?.sheet; // Workspace에서 전달받은 시트 정보
  const { user } = useContext(UserContext);

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  // 한 페이지에 20건씩 (예: 총 10,000건이면 500페이지)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // search state 추가
  const [search, setSearch] = useState("");
  const onChangeSearch = (e) => setSearch(e.target.value);

  // 상세 패널과 고객 리스트 영역 DOM 접근을 위한 ref
  const detailPanelRef = useRef(null);
  const listContainerRef = useRef(null);

  useEffect(() => {
    async function fetchSheetData() {
      if (sheet && window.gapi && window.gapi.client) {
        try {
          await window.gapi.client.load("sheets", "v4");
          const spreadsheetInfo =
            await window.gapi.client.sheets.spreadsheets.get({
              spreadsheetId: sheet.sheetId,
            });
          const defaultSheetName =
            spreadsheetInfo.result.sheets[0].properties.title;
          // 범위: A1부터 Z10000까지 (최대 10,000행)
          const range = `'${defaultSheetName}'!A1:Z10000`;
          const response =
            await window.gapi.client.sheets.spreadsheets.values.get({
              spreadsheetId: sheet.sheetId,
              range: range,
            });
          const values = response.result.values;
          if (values && values.length > 1) {
            // 첫 행을 컬럼 키로 사용하여 나머지 행들을 객체로 변환
            const headers = values[0];
            const dataRows = values.slice(1);
            const parsedCustomers = dataRows.map((row) =>
              headers.reduce((acc, header, index) => {
                acc[header] = row[index] || "";
                return acc;
              }, {})
            );
            setCustomers(parsedCustomers);
            if (parsedCustomers.length > 0) {
              setSelectedCustomer(parsedCustomers[0]);
            }
            console.log("Fetched customers:", parsedCustomers);
          }
        } catch (error) {
          console.error("Error fetching sheet data:", error);
          alert("고객 데이터를 불러오는 데 실패했습니다.");
        }
      }
    }
    fetchSheetData();
  }, [sheet]);

  // 페이지네이션 계산
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = customers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(customers.length / itemsPerPage);

  // 검색어에 맞게 필터링 (고객 이름, 이메일 주소, 연락처, 주문 상태)
  const filteredCustomers = currentCustomers.filter((customer) => {
    const lowerSearch = search.toLowerCase();
    return (
      (customer["고객명"] &&
        customer["고객명"].toLowerCase().includes(lowerSearch)) ||
      (customer["이메일 주소"] &&
        customer["이메일 주소"].toLowerCase().includes(lowerSearch)) ||
      (customer["연락처"] &&
        customer["연락처"].toLowerCase().includes(lowerSearch)) ||
      (customer["결제 상태"] &&
        customer["결제 상태"].toLowerCase().includes(lowerSearch))
    );
  });

  // 페이지 그룹 단위: 그룹 크기를 10으로 설정
  const groupSize = 10;
  const currentGroupStart =
    Math.floor((currentPage - 1) / groupSize) * groupSize + 1;
  const currentGroupEnd = Math.min(
    currentGroupStart + groupSize - 1,
    totalPages
  );

  const handleSelectCustomer = (customer) => {
    console.log("Selected customer:", customer);
    setSelectedCustomer(customer);
    setIsEditPanelOpen(true);
  };

  const closeEditPanel = () => {
    setIsEditPanelOpen(false);
  };

  const handleSaveChanges = () => {
    alert("변경 사항이 저장되었습니다.");
    closeEditPanel();
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const goToPrevGroup = () => {
    const newPage = Math.max(currentGroupStart - 1, 1);
    setCurrentPage(newPage);
  };

  const goToNextGroup = () => {
    const newPage = Math.min(currentGroupEnd + 1, totalPages);
    setCurrentPage(newPage);
  };

  // 외부 클릭 감지 (상세패널과 고객 리스트 영역 외부 클릭 시 닫힘)
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        isEditPanelOpen &&
        detailPanelRef.current &&
        !detailPanelRef.current.contains(event.target) &&
        listContainerRef.current &&
        !listContainerRef.current.contains(event.target)
      ) {
        closeEditPanel();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditPanelOpen]);

  return (
    <div className="customer-management-container">
      <Header />
      <div className="content-area">
        {/* 왼쪽 사이드바 영역 */}
        <div className="category-section">
          <Category />
        </div>

        {/* 고객 리스트 영역 - 검색바와 함께 */}
        <div
          ref={listContainerRef}
          className={`customer-list-section ${isEditPanelOpen ? "shrink" : ""}`}
        >
          <div className="search-bar-wrapper">
            <input
              value={search}
              onChange={onChangeSearch}
              placeholder="이름, 연락처, 이메일, 주문상태"
            />
          </div>
          <CustomerList
            customers={filteredCustomers}
            totalCount={customers.length}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={handleSelectCustomer}
          />
          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={handlePrevPage} disabled={currentPage === 1}>
                Prev
              </button>
              {currentGroupStart > 1 && (
                <button onClick={goToPrevGroup}>&laquo;</button>
              )}
              {Array.from(
                { length: currentGroupEnd - currentGroupStart + 1 },
                (_, idx) => {
                  const pageNumber = currentGroupStart + idx;
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => handlePageChange(pageNumber)}
                      className={currentPage === pageNumber ? "active" : ""}
                    >
                      {pageNumber}
                    </button>
                  );
                }
              )}
              {currentGroupEnd < totalPages && (
                <button onClick={goToNextGroup}>&raquo;</button>
              )}
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={detailPanelRef}
        className={`customer-edit-panel ${isEditPanelOpen ? "open" : ""}`}
      >
        {selectedCustomer ? (
          <CustomerEditer
            customer={selectedCustomer}
            onChange={(key, newValue) =>
              setSelectedCustomer((prev) => ({ ...prev, [key]: newValue }))
            }
            onClose={closeEditPanel}
            onSave={handleSaveChanges}
          />
        ) : (
          <div className="panel-placeholder">
            고객 목록에서 고객을 선택하세요.
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerManagement;
