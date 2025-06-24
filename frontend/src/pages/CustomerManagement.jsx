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
  const { user, excelFile } = useContext(UserContext);
  const { state } = useLocation();

  // 고객 목록 및 편집 상태
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  // 페이징
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  // 시트 메타
  const [sheetName, setSheetName] = useState("고객_정보");
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [headerMap, setHeaderMap] = useState({});
  const [lastChangedKey, setLastChangedKey] = useState(null);
  // 검색
  const [search, setSearch] = useState("");
  const onChangeSearch = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };
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

  // XLSX 파일 기반 데이터 로드를 위한 백엔드 API 호출
  const fetchXlsxData = async (filePath, sheetName) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/excel/worksheet-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filePath: filePath,
          sheetName: sheetName
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('XLSX 데이터 로드 오류:', error);
      throw error;
    }
  };

  // XLSX 파일 데이터 로드 및 헤더 매핑
  const fetchSheetData = async () => {
    console.log("fetchSheetData 시작 (XLSX 모드):", { excelFile });

    if (!excelFile && !user) {
      console.log("Excel 파일 정보 또는 사용자 정보가 없음");
      setError("Excel 파일 정보를 찾을 수 없습니다.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 기본 XLSX 파일 경로 설정 (백엔드 상대 경로)
      const filePath = excelFile?.path || 'data/GRM_주문_데이터.xlsx';
      const targetSheetName = '고객_정보';

      console.log("XLSX 파일 로드 시도:", { filePath, targetSheetName });

      // 백엔드에서 XLSX 데이터 가져오기
      const response = await fetchXlsxData(filePath, targetSheetName);
      console.log("XLSX 데이터 응답:", response);

      if (!response.success || !response.data) {
        throw new Error(response.message || 'XLSX 데이터를 불러올 수 없습니다.');
      }

      const vals = response.data;
      if (!vals || vals.length < 2) {
        console.log("데이터가 충분하지 않음");
        setCustomers([]);
        setError("XLSX 파일에 데이터가 없습니다.");
        return;
      }

      // 헤더 설정
      const headers = vals[0];
      console.log("XLSX 헤더:", headers);
      setSheetHeaders(headers);
      setSheetName(targetSheetName);

      // 필수 헤더 확인 (더 유연하게)
      const requiredHeaders = ["고객ID", "고객명", "연락처"];
      const missingRequiredHeaders = requiredHeaders.filter(
        (h) => !headers.includes(h)
      );
      
      if (missingRequiredHeaders.length > 0) {
        console.warn("필수 헤더 누락:", missingRequiredHeaders);
        setError(
          `XLSX 파일에 필수 헤더가 누락되었습니다: ${missingRequiredHeaders.join(", ")}`
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

      // 고객 데이터 처리
      const customerData = vals.slice(1).map((row, index) => {
        const customer = {};
        headers.forEach((header, i) => {
          customer[header] = row[i] || "";
        });
        customer.__rowNum__ = index + 2; // 스프레드시트 행 번호 (1은 헤더)
        return customer;
      });

      console.log(`${customerData.length}명의 고객 데이터 로드됨`);
      setCustomers(customerData);
    } catch (error) {
      console.error("데이터 로드 오류:", error);
      setError(`데이터를 불러오는 중 오류가 발생했습니다: ${error.message}`);
      
      // 오류 발생 시 더미 데이터 제공 (테스트용)
      const dummyCustomers = [
        {
          고객ID: "CUST001",
          고객명: "김철수",
          연락처: "010-1234-5678",
          이메일: "kim@example.com",
          생년월일: "1990-01-01",
          가입일: "2023-01-01",
          마지막_구매일: "2024-01-01",
          총_구매_금액: "150000",
          총_구매_횟수: "5",
          탄소_감축_등급: "Bronze",
          탄소_감축_점수: "1250",
          __rowNum__: 2
        },
        {
          고객ID: "CUST002", 
          고객명: "이영희",
          연락처: "010-9876-5432",
          이메일: "lee@example.com",
          생년월일: "1985-05-15",
          가입일: "2023-02-01",
          마지막_구매일: "2024-01-15",
          총_구매_금액: "280000",
          총_구매_횟수: "8",
          탄소_감축_등급: "Silver",
          탄소_감축_점수: "2100",
          __rowNum__: 3
        }
      ];
      
      setCustomers(dummyCustomers);
      setSheetHeaders(["고객ID", "고객명", "연락처", "이메일", "생년월일", "가입일", "마지막_구매일", "총_구매_금액", "총_구매_횟수", "탄소_감축_등급", "탄소_감축_점수"]);
      console.log("더미 데이터로 fallback");
    } finally {
      setIsLoading(false);
    }
  };

  // 재시도 함수
  const handleRetry = () => {
    fetchSheetData();
  };

  useEffect(() => {
    console.log("useEffect 실행 - 컴포넌트 마운트시 데이터 로드");
    fetchSheetData();
  }, [excelFile]);

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
      생년월일: "",
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

  // XLSX 파일에 데이터 저장
  const saveToXlsx = async (data, isNew = false) => {
    try {
      const filePath = excelFile?.path || 'data/GRM_주문_데이터.xlsx';
      
      let response;
      if (isNew) {
        // 새 행 추가
        response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/excel/worksheet-data/append`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            filePath: filePath,
            sheetName: sheetName,
            data: [sheetHeaders.map(h => data[h] || "")]
          })
        });
      } else {
        // 기존 행 업데이트
        response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/excel/worksheet-data`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            filePath: filePath,
            sheetName: sheetName,
            rowIndex: data.__rowNum__ - 1, // 0-based index
            data: sheetHeaders.map(h => data[h] || "")
          })
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('XLSX 데이터 저장 오류:', error);
      throw error;
    }
  };

  // 변경 이력 저장 (XLSX 기반)
  const saveChangeHistory = async (changes) => {
    if (!changes || changes.length === 0) return;

    try {
      const filePath = excelFile?.path || 'data/GRM_주문_데이터.xlsx';
      
      // 변경 이력 데이터 준비
      const historyData = changes.map(change => [
        new Date().toISOString(),
        user.email,
        change.uniqueId,
        change.fieldName,
        change.oldValue || '',
        change.newValue || ''
      ]);

      // ChangeHistory 시트에 데이터 추가
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/excel/worksheet-data/append`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filePath: filePath,
          sheetName: 'ChangeHistory',
          data: historyData
        })
      });

      if (response.ok) {
        console.log('변경 이력이 ChangeHistory 시트에 저장되었습니다.');
      }
    } catch (error) {
      console.error('ChangeHistory 저장 중 오류:', error);
    }
  };

  // 저장 (추가 or 수정)
  const handleSaveChanges = async () => {
    if (!selectedCustomer) {
      alert("선택된 고객이 없습니다.");
      return;
    }

    try {
      if (selectedCustomer.__rowNum__ == null) {
        // 신규 추가
        await saveToXlsx(selectedCustomer, true);
        CustomToast.success("새로운 고객이 추가되었습니다.", {
          position: "bottom-right",
        });
        fetchSheetData(); // 데이터 다시 로드
        setSelectedCustomer(null);
        setIsEditPanelOpen(false);
        return;
      } else {
        // 기존 고객 수정 - 변경 이력 추적
        const rowNum = selectedCustomer.__rowNum__;
        const originalCustomer = customers.find(c => c.__rowNum__ === rowNum);
        
        // 변경된 필드들 찾기
        const changes = [];
        const uniqueId = selectedCustomer["고객ID"] || `row-${rowNum}`;
        
        // 필드 매핑 (한글 필드명을 영문으로 매핑)
        const fieldNameMap = {
          '고객ID': 'customer_id',
          '고객명': 'name',
          '연락처': 'phone',
          '이메일': 'email',
          '생년월일': 'birth_date',
          '가입일': 'join_date',
          '마지막_구매일': 'last_purchase_date',
          '총_구매_금액': 'total_purchase_amount',
          '총_구매_횟수': 'total_purchase_count',
          '탄소_감축_등급': 'carbon_reduction_grade',
          '탄소_감축_점수': 'carbon_reduction_score'
        };

        if (originalCustomer) {
          for (const field of sheetHeaders) {
            const oldValue = originalCustomer[field] || '';
            const newValue = selectedCustomer[field] || '';
            
            if (oldValue !== newValue) {
              changes.push({
                uniqueId: uniqueId,
                fieldName: fieldNameMap[field] || field,
                oldValue: oldValue,
                newValue: newValue
              });
            }
          }
        }

        // XLSX 파일 업데이트
        await saveToXlsx(selectedCustomer, false);

        // 변경 이력이 있으면 ChangeHistory 시트에 저장
        if (changes.length > 0) {
          await saveChangeHistory(changes);
          console.log(`${changes.length}개의 필드 변경이 ChangeHistory에 기록되었습니다.`);
        }

        CustomToast.success("고객 정보가 업데이트되었습니다.", {
          position: "bottom-right",
        });
        fetchSheetData(); // 데이터 다시 로드
        setSelectedCustomer(null);
        setIsEditPanelOpen(false);
      }
    } catch (error) {
      console.error("저장 중 오류:", error);
      CustomToast.error(`저장 중 오류가 발생했습니다: ${error.message}`, {
        position: "bottom-right",
      });
    }
  };

  // 삭제 처리 (XLSX 기반)
  const handleDelete = async () => {
    if (!selectedCustomer || selectedCustomer.__rowNum__ == null) {
      alert("삭제할 고객을 선택해주세요.");
      return;
    }

    const confirmDelete = window.confirm(
      `${selectedCustomer["고객명"]} 고객의 정보를 삭제하시겠습니까?`
    );
    if (!confirmDelete) return;

    try {
      const filePath = excelFile?.path || 'data/GRM_주문_데이터.xlsx';
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/excel/worksheet-data/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filePath: filePath,
          sheetName: sheetName,
          rowIndex: selectedCustomer.__rowNum__ - 1 // 0-based index
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      CustomToast.success("고객 정보가 삭제되었습니다.", {
        position: "bottom-right",
      });
      fetchSheetData(); // 데이터 다시 로드
      setSelectedCustomer(null);
      setIsEditPanelOpen(false);
    } catch (error) {
      console.error("삭제 중 오류:", error);
      CustomToast.error(`삭제 중 오류가 발생했습니다: ${error.message}`, {
        position: "bottom-right",
      });
    }
  };

  // 클릭아웃 감지용 useEffect
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
        setSelectedCustomer(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isEditPanelOpen]);

  // 고객 선택
  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setIsEditPanelOpen(true);
  };

  // 데이터 객체화 및 필터링
  const filtered = customers.filter((customer) => {
    const customerName = customer["고객명"] || "";
    const customerId = customer["고객ID"] || "";
    const phone = customer["연락처"] || "";
    const email = customer["이메일"] || "";
    
    return (
      customerName.toLowerCase().includes(search.toLowerCase()) ||
      customerId.toLowerCase().includes(search.toLowerCase()) ||
      phone.includes(search) ||
      email.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentItems = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (isLoading) {
    return (
      <div className="customer-management">
        <Header />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>고객 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-management">
        <Header />
        <div className="error-container">
          <div className="error-message">
            <i className="fas fa-exclamation-triangle"></i>
            <h3>오류가 발생했습니다</h3>
            <p>{error}</p>
            <button onClick={handleRetry} className="retry-button">
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-management">
      <Header />
      
      <div className="content-area">
        <div className="top-controls">
          <div className="sheet-info">
            <h2>고객 관리</h2>
            <p>시트: {sheetName} | 총 {filtered.length}명</p>
          </div>
          
          <div className="search-and-add">
            <div className="search-box">
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder="고객명, ID, 연락처, 이메일로 검색..."
                value={search}
                onChange={onChangeSearch}
              />
            </div>
            <button className="add-customer-btn" onClick={handleNewCustomer}>
              <i className="fas fa-plus"></i>
              신규 고객 추가
            </button>
          </div>
        </div>

        <div className="main-content">
          <div 
            className={`customer-list-container ${isEditPanelOpen ? 'with-panel' : ''}`}
            ref={listContainerRef}
          >
            <CustomerList
              customers={currentItems}
              onSelectCustomer={handleSelectCustomer}
              selectedCustomer={selectedCustomer}
              search={search}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalPages={totalPages}
              totalCustomers={filtered.length}
            />
          </div>

          {isEditPanelOpen && selectedCustomer && (
            <div className="customer-detail-panel" ref={detailPanelRef}>
              <CustomerEditer
                customer={selectedCustomer}
                onFieldChange={handleFieldChange}
                onSave={handleSaveChanges}
                onCancel={() => {
                  setIsEditPanelOpen(false);
                  setSelectedCustomer(null);
                }}
                onDelete={handleDelete}
                lastChangedKey={lastChangedKey}
                options={options}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerManagement;
