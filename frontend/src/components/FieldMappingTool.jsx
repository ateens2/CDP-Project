import React, { useState } from "react";
import "./FieldMappingTool.css";

const FieldMappingTool = ({ sheet, onMapComplete }) => {
  const [loading, setLoading] = useState(false);
  const [headers, setHeaders] = useState([]);
  const [headersFetched, setHeadersFetched] = useState(false);
  const [mappingResult, setMappingResult] = useState(null);
  const [error, setError] = useState(null);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  // 스프레드시트 헤더 가져오기
  const fetchHeaders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${backendUrl}/api/sheets/headers?spreadsheetId=${sheet.sheetId}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setHeaders(data.headers);
      setHeadersFetched(true);
    } catch (err) {
      console.error("Error fetching sheet headers:", err);
      setError(err.message || "Failed to fetch sheet headers");
    } finally {
      setLoading(false);
    }
  };

  // 필드 매핑 실행
  const startFieldMapping = async () => {
    if (!headers.length) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/api/sheets/map-fields`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spreadsheetId: sheet.sheetId,
          headers,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        // data.message 에 구글 API 에러 메시지가 담겨 있음
        throw new Error(
          data.message || `Error mapping fields (${response.status})`
        );
      }
      const result = data;
      setMappingResult(result);

      if (onMapComplete) {
        onMapComplete(result);
      }
    } catch (err) {
      console.error("Error mapping fields:", err);
      setError(err.message || "Failed to map fields");
    } finally {
      setLoading(false);
    }
  };

  // 결과 표시
  const renderMappingResults = () => {
    if (!mappingResult) return null;

    return (
      <div className="mapping-results">
        <h3>필드 매핑 결과</h3>
        <p className="success-message">{mappingResult.message}</p>
        
        {/* 제품 판매 기록 시트 매핑 결과 */}
        <div className="mapping-section">
          <h4>🛒 제품 판매 기록 시트</h4>
          <table>
            <thead>
              <tr>
                <th>원본 필드</th>
                <th>매핑된 필드</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(mappingResult.salesMapping || {}).map(([originalField, mappedField], index) => (
                <tr key={index}>
                  <td>{originalField}</td>
                  <td>{mappedField || '매핑 없음'}</td>
                  <td>
                    <span className={mappedField ? 'status-success' : 'status-failed'}>
                      {mappedField ? '✅ 성공' : '❌ 실패'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 고객 정보 시트 매핑 결과 */}
        <div className="mapping-section">
          <h4>👥 고객 정보 시트</h4>
          <table>
            <thead>
              <tr>
                <th>원본 필드</th>
                <th>매핑된 필드</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(mappingResult.customerMapping || {}).map(([originalField, mappedField], index) => (
                <tr key={index}>
                  <td>{originalField}</td>
                  <td>{mappedField || '매핑 없음'}</td>
                  <td>
                    <span className={mappedField ? 'status-success' : 'status-failed'}>
                      {mappedField ? '✅ 성공' : '❌ 실패'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 생성된 시트 정보 */}
        <div className="created-sheets">
          <h4>📊 생성된 시트</h4>
          <div className="sheet-info">
            <div className="sheet-item">
              <span className="sheet-icon">🛒</span>
              <span className="sheet-name">{mappingResult.salesSheetName}</span>
              <span className="sheet-description">제품 판매 기록 및 주문 정보</span>
            </div>
            <div className="sheet-item">
              <span className="sheet-icon">👥</span>
              <span className="sheet-name">{mappingResult.customerSheetName}</span>
              <span className="sheet-description">고객 기본 정보 (중복 제거됨)</span>
            </div>
          </div>
        </div>

        {/* 특별 처리 안내 */}
        <div className="special-processing">
          <h4>⚠️ 특별 처리 사항</h4>
          <ul>
            <li><strong>거래 완료 일자:</strong> 매핑되지 않은 경우 주문 일자 + 3일로 자동 계산</li>
            <li><strong>주문 상태:</strong> 매핑되지 않은 경우 '거래 완료'로 기본값 설정</li>
            <li><strong>고객 정보:</strong> 중복된 고객은 자동으로 제거됨</li>
            <li><strong>총 구매 금액:</strong> 제품 판매 기록을 기반으로 고객별로 자동 계산됨</li>
            <li><strong>총 구매 횟수:</strong> 제품 판매 기록을 기반으로 고객별로 자동 계산됨</li>
            <li><strong>마지막 구매일:</strong> 제품 판매 기록에서 가장 최근 주문 일자로 자동 설정됨</li>
            <li><strong>탄소 감축 점수:</strong> 구매한 제품별로 카테고리 기준 제품 대비 탄소 감축량을 계산하여 자동 산출됨</li>
            <li><strong>탄소 감축 등급:</strong> 탄소 감축 점수에 따라 브론즈/실버/골드/플래티넘/다이아몬드 등급으로 자동 분류됨</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="field-mapping-tool">
      <h2>AI 필드 매핑 도구</h2>
      <p className="description">
        이 도구는 스프레드시트의 열 이름을 분석하여 표준 필드로 매핑합니다. 매핑
        후에는 새로운 시트가 생성됩니다.
      </p>

      {!headersFetched && !loading && (
        <button
          className="fetch-headers-btn"
          onClick={fetchHeaders}
          disabled={loading}
        >
          스프레드시트 열 정보 가져오기
        </button>
      )}

      {headersFetched && headers.length > 0 && !mappingResult && (
        <div className="headers-section">
          <h3>감지된 열 ({headers.length}개)</h3>
          <div className="headers-list">
            {headers.map((header, index) => (
              <div key={index} className="header-item">
                {header}
              </div>
            ))}
          </div>
          <button
            className="start-mapping-btn"
            onClick={startFieldMapping}
            disabled={loading}
          >
            AI 필드 매핑 시작
          </button>
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>처리 중입니다...</p>
        </div>
      )}

      {error && <div className="error-message">오류: {error}</div>}

      {renderMappingResults()}

      {mappingResult && (
        <div className="post-mapping-actions">
          <p>
            <strong>'{mappingResult.salesSheetName}'</strong>
            {mappingResult.salesSheetExists ? ' (업데이트됨)' : ' (새로 생성됨)'}
            과 <strong>'{mappingResult.customerSheetName}'</strong>
            {mappingResult.customerSheetExists ? ' (업데이트됨)' : ' (새로 생성됨)'}
            {' '}작업이 성공적으로 완료되었습니다.
          </p>
          <p>이제 생성된 시트에서 데이터 분석 및 관리 작업을 진행할 수 있습니다.</p>
        </div>
      )}
    </div>
  );
};

export default FieldMappingTool;
