import React, { useState, useEffect, useContext, useRef } from "react";
import { useLocation } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import Header from "../components/Header";
import Category from "../components/Category";
import CustomerList from "../components/CustomerList";
import CustomerEditer from "../components/CustomerEditer";
import "./CustomerManagement.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

const CustomerManagement = () => {
  const { state } = useLocation();
  const sheet = state?.sheet;
  const { user } = useContext(UserContext);

  // 고객 목록 및 편집 상태
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  // 페이징
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  // 시트 메타
  const [sheetName, setSheetName] = useState("");
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [headerMap, setHeaderMap] = useState({});
  const [lastChangedKey, setLastChangedKey] = useState(null);
  const [activeSheetId, setActiveSheetId] = useState(null);
  // 검색
  const [search, setSearch] = useState("");
  const onChangeSearch = (e) => setSearch(e.target.value);
  // 편집 패널 및 리스트 컨테이너 refs (클릭아웃 감지용)
  const detailPanelRef = useRef(null);
  const listContainerRef = useRef(null);

  // --- 라디오칩 옵션 생성 (시트에서 추출된 고유 값) ---
  const paymentStatuses = Array.from(
    new Set(customers.map((c) => c["결제 상태"]).filter((v) => v))
  );
  const paymentMethods = Array.from(
    new Set(customers.map((c) => c["결제 수단"]).filter((v) => v))
  );
  const issueTypes = Array.from(
    new Set(customers.map((c) => c["이슈 유형"]).filter((v) => v))
  );
  const progressStatuses = Array.from(
    new Set(customers.map((c) => c["진행상태"]).filter((v) => v))
  );
  const options = {
    paymentStatuses,
    paymentMethods,
    issueTypes,
    progressStatuses,
  };

  // 시트 데이터 로드 및 헤더 매핑
  const fetchSheetData = async () => {
    if (!sheet || !window.gapi?.client) return;
    await window.gapi.client.load("sheets", "v4");
    const meta = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: sheet.sheetId,
    });
    const name = meta.result.sheets[0].properties.title;
    const sheetId = meta.result.sheets[0].properties.sheetId;
    setSheetName(name);
    setActiveSheetId(sheetId);

    const rangeAll = `'${name}'!A1:Z10000`;
    const resp = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: sheet.sheetId,
      range: rangeAll,
    });
    const vals = resp.result.values || [];
    if (vals.length < 2) return;

    // 헤더, 맵 설정
    const headers = vals[0];
    setSheetHeaders(headers);
    const map = headers.reduce(
      (acc, h, i) => ({
        ...acc,
        [h]: { index: i, letter: String.fromCharCode(65 + i) },
      }),
      {}
    );
    setHeaderMap(map);

    // 데이터 객체화 및 필터링
    const allRows = vals.slice(1).map((row, idx) => {
      const obj = headers.reduce(
        (o, h, i) => ({ ...o, [h]: row[i] ?? "" }),
        {}
      );
      return { __rowNum__: idx + 2, ...obj };
    });
    const filtered = allRows.filter((r) =>
      Object.entries(r).some(([k, v]) => k !== "__rowNum__" && v !== "")
    );
    setCustomers(filtered);
    if (filtered.length) setSelectedCustomer(filtered[0]);
  };

  useEffect(() => {
    fetchSheetData();
  }, [sheet]);

  // 신규 고객 생성
  const handleNewCustomer = () => {
    if (!sheetHeaders.length) return;
    const empty = sheetHeaders.reduce((o, h) => ({ ...o, [h]: "" }), {});
    empty.__rowNum__ = null;
    setLastChangedKey(null);
    setSelectedCustomer(empty);
    setIsEditPanelOpen(true);
  };

  // 필드 변경
  const handleFieldChange = (key, val) => {
    setLastChangedKey(key);
    setSelectedCustomer((prev) => ({ ...prev, [key]: val }));
  };

  // 저장 (추가 or 수정)
  const handleSaveChanges = async () => {
    if (!sheet || !window.gapi?.client) return;
    await window.gapi.client.load("sheets", "v4");
    if (selectedCustomer.__rowNum__ == null) {
      // 추가
      const values = sheetHeaders.map((h) => selectedCustomer[h] ?? "");
      await window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: sheet.sheetId,
        range: `'${sheetName}'!A1:Z`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values: [values] },
      });
      alert("새로운 고객이 시트에 추가되었습니다.");
      window.location.reload();
      return;
    } else {
      // 수정
      const rowNum = selectedCustomer.__rowNum__;
      const key = lastChangedKey;
      if (rowNum && key) {
        const col = headerMap[key].letter;
        const range = `'${sheetName}'!${col}${rowNum}`;
        await window.gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: sheet.sheetId,
          range,
          valueInputOption: "RAW",
          resource: { values: [[selectedCustomer[key]]] },
        });
        setCustomers((prev) =>
          prev.map((c) => (c.__rowNum__ === rowNum ? selectedCustomer : c))
        );
        alert("고객 정보가 업데이트 되었습니다.");
      }
    }
    setLastChangedKey(null);
    setIsEditPanelOpen(false);
  };

  // 삭제
  const handleDelete = async () => {
    if (!sheet || activeSheetId == null || selectedCustomer.__rowNum__ == null)
      return;
    await window.gapi.client.load("sheets", "v4");
    const rowIndex = selectedCustomer.__rowNum__ - 1;
    await window.gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheet.sheetId,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: activeSheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });
    alert("고객이 삭제되었습니다.");
    window.location.reload();
  };

  // 페이징 & 검색
  const idxLast = currentPage * itemsPerPage;
  const idxFirst = idxLast - itemsPerPage;
  const pageRows = customers.slice(idxFirst, idxLast);
  const totalPages = Math.ceil(customers.length / itemsPerPage);
  const filteredList = pageRows.filter((c) => {
    const q = search.toLowerCase();
    return ["고객명", "이메일 주소", "연락처", "결제 상태"].some((f) =>
      c[f]?.toLowerCase().includes(q)
    );
  });

  // 상세 패널 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e) => {
      if (
        isEditPanelOpen &&
        detailPanelRef.current &&
        !detailPanelRef.current.contains(e.target) &&
        listContainerRef.current &&
        !listContainerRef.current.contains(e.target)
      ) {
        setIsEditPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isEditPanelOpen]);

  // 페이지네이션 그룹 계산
  const groupSize = 10;
  const groupStart = Math.floor((currentPage - 1) / groupSize) * groupSize + 1;
  const groupEnd = Math.min(groupStart + groupSize - 1, totalPages);

  return (
    <div className="customer-management-container">
      <Header />
      <div className="content-area">
        <div className="category-section">
          <Category />
        </div>
        <div
          ref={listContainerRef}
          className={`customer-list-section ${isEditPanelOpen ? "shrink" : ""}`}
        >
          {/* 툴바: 검색, 엑셀, 신규 */}
          <div className="toolbar">
            <div className="search-bar-wrapper">
              <i className="fas fa-search" />
              <input
                value={search}
                onChange={onChangeSearch}
                placeholder="고객명, 이메일, 전화번호, 결제상태로 검색"
              />
            </div>
            <div className="toolbar-buttons">
              <button className="toolbar-button" title="엑셀 내보내기">
                <i className="fas fa-file-excel" />
              </button>
              <button className="btn-new-customer" onClick={handleNewCustomer}>
                <i className="fas fa-plus" /> 신규 고객
              </button>
            </div>
          </div>

          {/* 고객 리스트 */}
          <CustomerList
            customers={filteredList}
            totalCount={customers.length}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={(c) => {
              setSelectedCustomer(c);
              setIsEditPanelOpen(true);
            }}
            onDelete={handleDelete}
          />

          {/* 페이징 */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() =>
                  currentPage > 1 && setCurrentPage(currentPage - 1)
                }
                disabled={currentPage === 1}
              >
                Prev
              </button>
              {groupStart > 1 && (
                <button onClick={() => setCurrentPage(groupStart - 1)}>
                  &laquo;
                </button>
              )}
              {Array.from(
                { length: groupEnd - groupStart + 1 },
                (_, i) => groupStart + i
              ).map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={currentPage === p ? "active" : ""}
                >
                  {p}
                </button>
              ))}
              {groupEnd < totalPages && (
                <button onClick={() => setCurrentPage(groupEnd + 1)}>
                  &raquo;
                </button>
              )}
              <button
                onClick={() =>
                  currentPage < totalPages && setCurrentPage(currentPage + 1)
                }
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
            options={options}
            onChange={handleFieldChange}
            onClose={() => setIsEditPanelOpen(false)}
            onSave={handleSaveChanges}
            onDelete={handleDelete}
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
