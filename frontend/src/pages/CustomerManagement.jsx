import React, { useState, useEffect, useContext, useRef } from "react";
import { UserContext } from "../contexts/UserContext";
import { useLocation } from "react-router-dom";
import Header from "../components/Header";
import CustomerList from "../components/CustomerList";
import CustomerEditer from "../components/CustomerEditer";
import "./CustomerManagement.css";
import CustomToast from "../toast";
import "@fortawesome/fontawesome-free/css/all.min.css";

const CustomerManagement = () => {
  const { user, sheets } = useContext(UserContext);
  const { state } = useLocation();
  const sheet =
    state?.sheet || (sheets && sheets.length > 0 ? sheets[0] : null);

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
  // 로딩 상태 추가
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- 라디오칩 옵션 생성 (시트에서 추출된 고유 값) ---
  const paymentStatuses = Array.from(
    new Set(customers.map((c) => c["order_status"]).filter((v) => v))
  );
  const paymentMethods = Array.from(
    new Set(customers.map((c) => c["payment_method"]).filter((v) => v))
  );
  const issueTypes = Array.from(
    new Set(customers.map((c) => c["inquiry_type"]).filter((v) => v))
  );
  const progressStatuses = Array.from(
    new Set(customers.map((c) => c["inquiry_status"]).filter((v) => v))
  );
  const options = {
    paymentStatuses,
    paymentMethods,
    issueTypes,
    progressStatuses,
  };

  // gapi 클라이언트 초기화 대기
  const waitForGapi = async () => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 30; // 최대 3초 대기

      const checkGapi = () => {
        attempts++;
        if (window.gapi?.client) {
          resolve(true);
        } else if (attempts >= maxAttempts) {
          reject(new Error("Google API 클라이언트 로드 시간 초과"));
        } else {
          setTimeout(checkGapi, 100);
        }
      };

      checkGapi();
    });
  };

  // 시트 데이터 로드 및 헤더 매핑
  const fetchSheetData = async () => {
    console.log("fetchSheetData 시작:", { sheet, gapi: !!window.gapi?.client });

    if (!sheet) {
      console.log("시트 정보가 없음");
      setError("시트 정보를 찾을 수 없습니다.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // gapi 클라이언트가 로드될 때까지 대기
      await waitForGapi();
      await window.gapi.client.load("sheets", "v4");
      console.log("Google Sheets API 로드 완료");

      const meta = await window.gapi.client.sheets.spreadsheets.get({
        spreadsheetId: sheet.sheetId,
      });
      console.log("시트 메타데이터:", meta.result);

      const sheetsMeta = meta.result.sheets;
      console.log(
        "시트 목록:",
        sheetsMeta.map((s) => s.properties.title)
      );

      // "고객_정보" 시트를 찾고, 없으면 첫 번째 시트 사용
      const customerSheet = sheetsMeta.find(
        (s) => s.properties.title === "고객_정보"
      );
      console.log("고객_정보 시트 찾음:", customerSheet);

      const name = customerSheet
        ? customerSheet.properties.title
        : sheetsMeta[0].properties.title;
      const sheetId = customerSheet
        ? customerSheet.properties.sheetId
        : sheetsMeta[0].properties.sheetId;

      console.log("선택된 시트:", { name, sheetId });

      setSheetName(name);
      setActiveSheetId(sheetId);

      if (!customerSheet) {
        console.warn(
          "고객_정보 시트를 찾을 수 없습니다. 첫 번째 시트를 사용합니다."
        );
        setError(
          "고객_정보 시트를 찾을 수 없습니다. 먼저 필드 매핑 도구를 사용하여 고객_정보 시트를 생성해주세요."
        );
        return;
      }

      const rangeAll = `'${name}'!A1:J`; // 고객_정보 시트는 A부터 J열까지
      console.log("데이터 범위:", rangeAll);

      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: sheet.sheetId,
        range: rangeAll,
      });
      console.log("시트 데이터 응답:", resp.result);

      const vals = resp.result.values || [];
      if (vals.length < 2) {
        console.log("데이터가 충분하지 않음");
        setCustomers([]);
        setError("시트에 데이터가 없습니다.");
        return;
      }

      // 헤더, 맵 설정
      const headers = vals[0];
      console.log("헤더:", headers);
      setSheetHeaders(headers);

      // 예상되는 고객_정보 시트 헤더 확인
      const expectedHeaders = [
        "고객ID",
        "고객명",
        "연락처",
        "이메일",
        "가입일",
        "마지막_구매일",
        "총_구매_금액",
        "총_구매_횟수",
        "탄소_감축_등급",
        "탄소_감축_점수",
      ];

      const missingHeaders = expectedHeaders.filter(
        (h) => !headers.includes(h)
      );
      if (missingHeaders.length > 0) {
        console.warn("누락된 헤더:", missingHeaders);
        setError(
          `고객_정보 시트에 필수 헤더가 누락되었습니다: ${missingHeaders.join(
            ", "
          )}\n먼저 필드 매핑 도구를 사용하여 올바른 시트를 생성해주세요.`
        );
        return;
      }

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

      // 고객명이 있는 행만 필터링
      const filtered = allRows.filter(
        (r) => r["고객명"] && r["고객명"].trim() !== ""
      );
      console.log("필터링된 데이터:", filtered.length, "행");

      setCustomers(filtered);
      if (filtered.length > 0) {
        setSelectedCustomer(filtered[0]);
        setIsEditPanelOpen(true);
      }
      setError(null);
    } catch (error) {
      console.error("시트 데이터 로드 중 오류:", error);
      setError(
        "시트 데이터를 로드하는 중 오류가 발생했습니다: " + error.message
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 재시도 함수
  const handleRetry = () => {
    fetchSheetData();
  };

  useEffect(() => {
    console.log("useEffect 실행 - sheet 변경:", sheet);
    if (sheet) {
      fetchSheetData();
    }
  }, [sheet]);

  // user 및 sheets가 로드된 후 추가 체크
  useEffect(() => {
    console.log("useEffect 실행 - user/sheets 변경:", {
      user: !!user,
      sheets: sheets?.length,
    });
    if (user && sheets && sheets.length > 0 && !sheet) {
      // sheets가 로드되었지만 sheet가 없는 경우, 첫 번째 시트 사용
      const firstSheet = sheets[0];
      console.log("첫 번째 시트 설정:", firstSheet);
      // fetchSheetData는 sheet dependency로 인해 자동 실행됨
    }
  }, [user, sheets]);

  // 신규 고객 생성
  const handleNewCustomer = () => {
    if (!sheetHeaders.length) {
      alert("시트 헤더 정보가 없습니다. 먼저 시트를 로드해주세요.");
      return;
    }

    // 고객_정보 시트의 기본 구조로 빈 객체 생성
    const empty = {
      고객ID: "",
      고객명: "",
      연락처: "",
      이메일: "",
      가입일: new Date().toISOString().split("T")[0], // 오늘 날짜
      마지막_구매일: "",
      총_구매_금액: "0",
      총_구매_횟수: "0",
      탄소_감축_등급: "Stone",
      탄소_감축_점수: "0",
    };
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
    if (!sheet || !window.gapi?.client) {
      alert("Google Sheets API가 로드되지 않았습니다.");
      return;
    }

    await window.gapi.client.load("sheets", "v4");

    try {
      if (selectedCustomer.__rowNum__ == null) {
        // 신규 추가
        const values = sheetHeaders.map((h) => selectedCustomer[h] ?? "");
        await window.gapi.client.sheets.spreadsheets.values.append({
          spreadsheetId: sheet.sheetId,
          range: `'${sheetName}'!A1:J`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          resource: { values: [values] },
        });
        CustomToast.success("새로운 고객이 추가되었습니다.", {
          position: "bottom-right",
        });
        fetchSheetData(); // 데이터 다시 로드
        setSelectedCustomer(null);
        setIsEditPanelOpen(false);
        return;
      } else {
        // 기존 고객 수정
        const rowNum = selectedCustomer.__rowNum__;
        const rowValues = sheetHeaders.map((h) => selectedCustomer[h] ?? "");
        const lastColLetter = String.fromCharCode(65 + sheetHeaders.length - 1);
        const range = `'${sheetName}'!A${rowNum}:${lastColLetter}${rowNum}`;

        await window.gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: sheet.sheetId,
          range,
          valueInputOption: "RAW",
          resource: { values: [rowValues] },
        });

        // 로컬 state도 업데이트
        setCustomers((prev) =>
          prev.map((c) =>
            c.__rowNum__ === rowNum ? { ...selectedCustomer } : c
          )
        );

        CustomToast.success("고객 정보가 성공적으로 업데이트 되었습니다.", {
          position: "bottom-right",
        });
      }
    } catch (error) {
      console.error("저장 중 오류:", error);
      CustomToast.error("저장중 오류가 발생했습니다", {
        position: "bottom-right",
      });
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!selectedCustomer || selectedCustomer.__rowNum__ == null) {
      alert("삭제할 고객을 선택해주세요.");
      return;
    }

    if (!confirm("정말로 이 고객을 삭제하시겠습니까?")) {
      return;
    }

    try {
      await window.gapi.client.load("sheets", "v4");

      const rowNum = selectedCustomer.__rowNum__;

      // 행 삭제 요청
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheet.sheetId,
        resource: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: activeSheetId,
                  dimension: "ROWS",
                  startIndex: rowNum - 1, // 0-based index
                  endIndex: rowNum,
                },
              },
            },
          ],
        },
      });

      CustomToast.success("고객이 삭제되었습니다.", {
        position: "bottom-right",
      });
      fetchSheetData(); // 데이터 다시 로드
      setSelectedCustomer(null);
      setIsEditPanelOpen(false);
    } catch (error) {
      console.error("삭제 중 오류:", error);
      CustomToast.error("삭제중 오류가 발생했습니다.", {
        position: "bottom-right",
      });
    }
  };

  // 클릭 아웃 감지
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

  // 고객 선택 처리
  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setIsEditPanelOpen(true);
  };

  // 검색 필터링
  const filteredCustomers = customers.filter((customer) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      (customer["고객명"] || "").toLowerCase().includes(searchLower) ||
      (customer["이메일"] || "").toLowerCase().includes(searchLower) ||
      (customer["연락처"] || "").toLowerCase().includes(searchLower) ||
      (customer["고객ID"] || "").toLowerCase().includes(searchLower)
    );
  });

  // 페이징
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  if (!user) {
    return (
      <div className="customer-management">
        <Header />
        <div className="main-content">
          <p>로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-management">
      <Header sheet={sheet} />
      <div className="main-content">
        <div className="customer-management-content">
          {/* 좌측: 고객 목록 */}
          <div className="customer-list-section" ref={listContainerRef}>
            <div className="search-and-add">
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="고객명, 이메일, 연락처로 검색..."
                  value={search}
                  onChange={onChangeSearch}
                  className="search-input"
                  disabled={isLoading}
                />
                <i className="fas fa-search search-icon"></i>
              </div>
              <button
                className="add-customer-btn"
                onClick={handleNewCustomer}
                disabled={isLoading || !!error}
              >
                <i className="fas fa-plus"></i>새 고객 추가
              </button>
            </div>

            {/* 로딩 상태 */}
            {isLoading && (
              <div className="loading-message">
                <i className="fas fa-spinner fa-spin"></i>
                <p>고객 데이터를 불러오는 중...</p>
              </div>
            )}

            {/* 에러 상태 */}
            {error && !isLoading && (
              <div className="error-message">
                <i className="fas fa-exclamation-triangle"></i>
                <p>{error}</p>
                <button className="retry-btn" onClick={handleRetry}>
                  <i className="fas fa-redo"></i>
                  다시 시도
                </button>
              </div>
            )}

            {/* 정상 상태: 고객 목록 */}
            {!isLoading && !error && (
              <>
                <CustomerList
                  customers={paginatedCustomers}
                  totalCount={filteredCustomers.length}
                  selectedCustomer={selectedCustomer}
                  onSelectCustomer={handleSelectCustomer}
                />

                {/* 페이징 */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      이전
                    </button>
                    <span className="page-info">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      다음
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 우측: 고객 상세 정보 */}
          {isEditPanelOpen && selectedCustomer && (
            <div className="customer-detail-section" ref={detailPanelRef}>
              <CustomerEditer
                customer={selectedCustomer}
                onChange={handleFieldChange}
                onSave={handleSaveChanges}
                onDelete={handleDelete}
              />
            </div>
          )}

          {/* 안내 메시지 */}
          {!isEditPanelOpen && (
            <div className="no-selection-message">
              <i className="fas fa-users"></i>
              <h3>고객을 선택해주세요</h3>
              <p>좌측 목록에서 고객을 클릭하여 상세 정보를 확인하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerManagement;
