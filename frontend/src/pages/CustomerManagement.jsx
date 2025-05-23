import React, { useState, useEffect, useContext, useRef } from "react";
import { useLocation } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid';
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
  const [originalSelectedCustomer, setOriginalSelectedCustomer] = useState(null);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  // 페이징
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  // 시트 메타
  const [currentSheetName, setCurrentSheetName] = useState("");
  const [originalSheetName, setOriginalSheetName] = useState("");
  const [isMappedSheet, setIsMappedSheet] = useState(false);
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [headerMap, setHeaderMap] = useState({});
  const [lastChangedKey, setLastChangedKey] = useState(null);
  const [activeSheetId, setActiveSheetId] = useState(null);
  // 검색
  const [search, setSearch] = useState("");
  const onChangeSearch = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1); // 검색어 변경 시 첫 페이지로 리셋
  };
  // 편집 패널 및 리스트 컨테이너 refs (클릭아웃 감지용)
  const detailPanelRef = useRef(null);
  const listContainerRef = useRef(null);

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

  // 시트 데이터 로드 및 헤더 매핑
  const fetchSheetData = async () => {
    if (!sheet || !window.gapi?.client) return;
    await window.gapi.client.load("sheets", "v4");
    const meta = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: sheet.sheetId,
    });
    const sheetsMeta = meta.result.sheets;
    
    // 원본 시트 이름 설정 (첫 번째 시트로 가정 또는 다른 로직으로 찾아야 함)
    // 여기서는 첫 번째 시트를 원본으로 간주합니다.
    const firstSheet = sheetsMeta[0];
    setOriginalSheetName(firstSheet.properties.title);

    const mappedSheetMeta = sheetsMeta.find((s) => s.properties.title === "Mapped_Data");
    
    let activeName = firstSheet.properties.title;
    let activeId = firstSheet.properties.sheetId;
    let usingMapped = false;

    if (mappedSheetMeta) {
      activeName = mappedSheetMeta.properties.title;
      activeId = mappedSheetMeta.properties.sheetId;
      usingMapped = true;
    } else {
      // Mapped_Data 시트가 없으면 원본 시트의 헤더와 데이터를 사용
      // (이 경우는 사용자가 아직 필드 매핑을 하지 않은 상태)
      console.log("Mapped_Data sheet not found, using original sheet:", activeName);
    }
    setCurrentSheetName(activeName);
    setActiveSheetId(activeId);
    setIsMappedSheet(usingMapped);

    const rangeAll = `'${activeName}'!A1:Z10000`; // 현재 활성화된 시트에서 데이터 로드
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
      return { __rowNum__: idx + 2, UniqueID: obj.UniqueID || null, ...obj };
    });
    const filtered = allRows.filter((r) =>
      Object.entries(r).some(([k, v]) => k !== "__rowNum__" && v !== "")
    );
    setCustomers(filtered);
    if (filtered.length) {
      setSelectedCustomer(filtered[0]);
      setOriginalSelectedCustomer(JSON.parse(JSON.stringify(filtered[0])));
    }
  };

  useEffect(() => {
    fetchSheetData();
    if (sheet && sheet.sheetId) {
      localStorage.setItem('selectedSpreadsheetId', sheet.sheetId);
    }
  }, [sheet]);

  // CustomerList에서 고객 선택 시 호출될 함수
  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setOriginalSelectedCustomer(JSON.parse(JSON.stringify(customer)));
    setIsEditPanelOpen(true);
  };

  // 신규 고객 생성
  const handleNewCustomer = () => {
    if (!sheetHeaders.length) return;
    const empty = sheetHeaders.reduce((o, h) => ({ ...o, [h]: "" }), {});
    empty.UniqueID = uuidv4();
    empty.__rowNum__ = null;
    setLastChangedKey(null);
    setSelectedCustomer(empty);
    setOriginalSelectedCustomer(JSON.parse(JSON.stringify(empty)));
    setIsEditPanelOpen(true);
  };

  // 필드 변경
  const handleFieldChange = (key, val) => {
    setLastChangedKey(key);
    setSelectedCustomer((prev) => ({ ...prev, [key]: val }));
  };

  // 안전하게 ChangeHistory 시트를 확인하고 생성하는 함수
  const ensureChangeHistorySheet = async () => {
    try {
      const meta = await window.gapi.client.sheets.spreadsheets.get({
        spreadsheetId: sheet.sheetId,
      });
      
      const changeHistorySheet = meta.result.sheets.find(
        s => s.properties.title === 'ChangeHistory'
      );

      if (!changeHistorySheet) {
        console.log('ChangeHistory 시트가 없어서 생성합니다...');
        
        // 기존 시트 이름들 확인
        const existingSheetNames = meta.result.sheets.map(s => s.properties.title);
        console.log('기존 시트 목록:', existingSheetNames);
        
        // ChangeHistory 시트 생성
        const batchUpdateResponse = await window.gapi.client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheet.sheetId,
          resource: {
            requests: [{
              addSheet: {
                properties: { 
                  title: 'ChangeHistory',
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 6
                  }
                }
              }
            }]
          }
        });
        
        console.log('시트 생성 응답:', batchUpdateResponse);

        // 헤더 추가
        await window.gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: sheet.sheetId,
          range: 'ChangeHistory!A1:F1',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [['Timestamp', 'UserEmail', 'UniqueID', 'FieldName', 'OldValue', 'NewValue']]
          }
        });
        
        console.log('ChangeHistory 시트 생성 및 헤더 설정 완료');
        return true;
      } else {
        console.log('ChangeHistory 시트가 이미 존재합니다.');
        return true;
      }
    } catch (error) {
      console.error('ChangeHistory 시트 확인/생성 중 오류:', error);
      return false;
    }
  };

  // 변경 이력을 ChangeHistory 시트에 직접 기록하는 함수
  const recordChangeHistoryDirectly = async (changes, UniqueID) => {
    if (!changes || changes.length === 0) return true; // 변경사항이 없으면 성공으로 처리

    try {
      await window.gapi.client.load("sheets", "v4");
      
      // ChangeHistory 시트 확인 및 생성
      const sheetReady = await ensureChangeHistorySheet();
      if (!sheetReady) {
        console.log('ChangeHistory 시트 준비 실패, 백엔드로 넘김');
        return false;
      }

      // 변경 이력 데이터 준비
      const rowsToAppend = changes.map(change => [
        new Date().toISOString(),
        user.email,
        UniqueID,
        change.fieldName,
        String(change.oldValue || ""),
        String(change.newValue || "")
      ]);

      console.log('ChangeHistory 시트에 추가할 데이터:', rowsToAppend);

      // ChangeHistory 시트에 데이터 추가
      await window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: sheet.sheetId,
        range: 'ChangeHistory!A:F',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: rowsToAppend }
      });

      console.log('변경 이력이 ChangeHistory 시트에 직접 기록되었습니다.');
      return true;
    } catch (error) {
      console.error('ChangeHistory 시트 직접 기록 실패:', error);
      // 변경 이력 기록 실패는 치명적이지 않으므로 고객 정보 수정은 계속 진행
      return false;
    }
  };

  // 저장 (추가 or 수정)
  const handleSaveChanges = async () => {
    if (!sheet || !window.gapi?.client || !selectedCustomer || !user?.email) return;
    await window.gapi.client.load("sheets", "v4");

    const currentCustomerData = { ...selectedCustomer };
    let alertMessage = "";
    let changesToRecord = [];
    
    // UniqueID 처리 로직 개선
    let customerUniqueId;
    
    if (currentCustomerData.__rowNum__ == null) { 
      // 신규 추가: 새 UniqueID 생성
      customerUniqueId = uuidv4();
      currentCustomerData.UniqueID = customerUniqueId;
      console.log('신규 고객 UniqueID 생성:', customerUniqueId);
    } else { 
      // 기존 수정: 기존 UniqueID 보존
      console.log('=== 기존 고객 수정 UniqueID 처리 ===');
      console.log('originalSelectedCustomer:', originalSelectedCustomer);
      console.log('selectedCustomer:', selectedCustomer);
      console.log('currentCustomerData:', currentCustomerData);
      
      // 여러 소스에서 UniqueID 찾기 (대소문자 모두 확인)
      customerUniqueId = originalSelectedCustomer?.UniqueID || 
                        originalSelectedCustomer?.uniqueID ||
                        selectedCustomer?.UniqueID || 
                        selectedCustomer?.uniqueID ||
                        currentCustomerData?.UniqueID ||
                        currentCustomerData?.uniqueID;
      
      console.log('찾은 기존 UniqueID:', customerUniqueId);
      console.log('UniqueID 타입:', typeof customerUniqueId);
      console.log('UniqueID 길이:', customerUniqueId ? customerUniqueId.length : 'undefined');
      
      // 빈 문자열이나 undefined/null 체크를 더 엄격하게
      if (!customerUniqueId || (typeof customerUniqueId === 'string' && customerUniqueId.trim() === '')) {
        // 기존 고객인데 UniqueID가 아예 없는 경우에만 새로 생성
        customerUniqueId = uuidv4();
        console.log('⚠️ 기존 고객에게 UniqueID 새로 부여:', customerUniqueId);
      } else {
        console.log('✅ 기존 고객 수정, 기존 UniqueID 사용:', customerUniqueId);
      }
      
      currentCustomerData.UniqueID = customerUniqueId;
    }

    // 업데이트할 시트 목록 결정
    const sheetsToUpdate = [currentSheetName];
    if (isMappedSheet && originalSheetName && originalSheetName !== currentSheetName) {
      sheetsToUpdate.push(originalSheetName);
    }

    for (const nameOfSheetToUpdate of sheetsToUpdate) {
      if (currentCustomerData.__rowNum__ == null) { // 신규 추가
        const valuesInOrder = sheetHeaders.map((h) => currentCustomerData[h] ?? "");
        
        try {
          await window.gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: sheet.sheetId,
            range: `'${nameOfSheetToUpdate}'!A1`,
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            resource: { values: [valuesInOrder] },
          });
          if (nameOfSheetToUpdate === currentSheetName) {
            alertMessage = "새로운 고객이 시트에 추가되었습니다.";
            changesToRecord = sheetHeaders.map(header => ({
                fieldName: header,
                oldValue: "",
                newValue: currentCustomerData[header] || ""
            }));
          }
        } catch (error) {
          console.error(`Error appending new customer to sheet ${nameOfSheetToUpdate}:`, error);
          alert(`시트 '${nameOfSheetToUpdate}'에 새 고객 추가 중 오류: ${error.message}`);
          return; // 한 시트라도 실패하면 중단
        }
      } else { // 기존 수정
        const rowNum = currentCustomerData.__rowNum__;
        const valuesInOrder = sheetHeaders.map((h) => currentCustomerData[h] ?? "");
        const lastColLetter = String.fromCharCode(65 + sheetHeaders.length - 1);
        const range = `'${nameOfSheetToUpdate}'!A${rowNum}:${lastColLetter}${rowNum}`;

        try {
          await window.gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: sheet.sheetId,
            range,
            valueInputOption: "USER_ENTERED",
            resource: { values: [valuesInOrder] },
          });
          
          if (nameOfSheetToUpdate === currentSheetName) {
            if (originalSelectedCustomer) {
              sheetHeaders.forEach(header => {
                if (header === 'UniqueID' || header === '__rowNum__') return;
                const oldValue = originalSelectedCustomer[header] || "";
                const newValue = currentCustomerData[header] || "";
                if (oldValue !== newValue) {
                  changesToRecord.push({
                    fieldName: header,
                    oldValue: String(oldValue),
                    newValue: String(newValue),
                  });
                }
              });
            }
            if (changesToRecord.length > 0) {
                alertMessage = "고객 정보가 업데이트 되었습니다.";
            } else {
                alertMessage = "변경된 내용이 없습니다.";
            }
            // 고객 리스트 업데이트는 나중에 한 번에 처리
            setOriginalSelectedCustomer(JSON.parse(JSON.stringify(currentCustomerData)));
          }
        } catch (error) {
          console.error(`Error updating customer in sheet ${nameOfSheetToUpdate}:`, error);
          alert(`시트 '${nameOfSheetToUpdate}' 고객 정보 업데이트 중 오류: ${error.message}`);
          return; // 한 시트라도 실패하면 중단
        }
      }
    }

    // 변경 이력 기록 - 기존 고객의 UniqueID 사용
    if (changesToRecord.length > 0) {
      console.log('변경 이력 기록 시작:', changesToRecord);
      console.log('변경된 고객의 UniqueID (기존 보존):', customerUniqueId);
      
      try {
        // 방법 1: 프론트엔드에서 Google API로 직접 기록
        const directRecordSuccess = await recordChangeHistoryDirectly(changesToRecord, customerUniqueId);
        
        if (!directRecordSuccess) {
          // 방법 2: 백엔드 API 사용 (기존 방식)
          try {
            console.log('백엔드 API를 통한 변경 이력 기록 시도');

            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
            const response = await fetch(`${backendUrl}/api/sheets/record-change`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                spreadsheetId: sheet.sheetId,
                sheetName: currentSheetName,
                UniqueID: customerUniqueId,
                changedBy: user.email,
                changes: changesToRecord,
              }),
            });

            console.log('API 응답 상태:', response.status);

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
              console.error("백엔드 API 변경 이력 기록 실패:", errorData);
              // 변경 이력 기록 실패는 경고만 표시하고 계속 진행
              console.warn("변경 이력 기록에 실패했지만 고객 정보 수정은 완료되었습니다.");
            } else {
              const successData = await response.json();
              console.log("백엔드 API를 통해 변경 이력이 기록되었습니다:", successData);
            }
          } catch (error) {
            console.error("백엔드 API 호출 중 네트워크 오류:", error);
            console.warn("변경 이력 기록에 실패했지만 고객 정보 수정은 완료되었습니다.");
          }
        }
      } catch (error) {
        console.error("변경 이력 기록 중 예상치 못한 오류:", error);
        console.warn("변경 이력 기록에 실패했지만 고객 정보 수정은 완료되었습니다.");
      }
    }
    
    // 성공적으로 처리된 후 고객 리스트 상태 즉시 업데이트
    if (currentCustomerData.__rowNum__ == null) {
      // 신규 고객 추가: 새로운 rowNum을 계산해서 리스트에 추가
      const newRowNum = Math.max(...customers.map(c => c.__rowNum__ || 0)) + 1;
      const newCustomerWithRowNum = { ...currentCustomerData, __rowNum__: newRowNum };
      
      setCustomers(prev => [...prev, newCustomerWithRowNum]);
      setSelectedCustomer(newCustomerWithRowNum);
      setOriginalSelectedCustomer(JSON.parse(JSON.stringify(newCustomerWithRowNum)));
      
      if (!alertMessage) {
        alertMessage = "새로운 고객이 시트에 추가되었습니다.";
      }
    } else {
      // 기존 고객 수정: 해당 고객의 데이터를 업데이트
      setCustomers(prev => {
        return prev.map(c => {
          // UniqueID와 __rowNum__ 둘 다 확인해서 정확한 고객을 찾기
          if ((c.UniqueID === customerUniqueId || c.uniqueID === customerUniqueId) && 
              c.__rowNum__ === currentCustomerData.__rowNum__) {
            return { ...currentCustomerData };
          }
          return c;
        });
      });
      setSelectedCustomer(currentCustomerData);
    }
    
    if (alertMessage) {
        alert(alertMessage);
    }

    setLastChangedKey(null);
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
  // 먼저 검색 필터를 적용
  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase();
    return ["name", "email", "contact", "order_status"].some((f) =>
      c[f]?.toLowerCase().includes(q)
    );
  });
  
  // 필터링된 결과에 페이징 적용
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const idxLast = currentPage * itemsPerPage;
  const idxFirst = idxLast - itemsPerPage;
  const filteredList = filteredCustomers.slice(idxFirst, idxLast);

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
            totalCount={filteredCustomers.length}
            onSelectCustomer={handleCustomerSelect}
            selectedCustomerId={selectedCustomer?.UniqueID}
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