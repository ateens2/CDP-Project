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
    if (!mappingResult || !mappingResult.mappingData) return null;

    return (
      <div className="mapping-results">
        <h3>필드 매핑 결과</h3>
        <p className="success-message">{mappingResult.message}</p>
        <table>
          <thead>
            <tr>
              <th>원본 필드</th>
              <th>표준 필드</th>
              <th>매칭 점수</th>
            </tr>
          </thead>
          <tbody>
            {mappingResult.mappingData.map((item, index) => (
              <tr key={index}>
                <td>{item.originalField}</td>
                <td>{item.standardField}</td>
                <td>{item.score.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <p>새 시트 '{mappingResult.newSheetName}'가 생성되었습니다.</p>
          <p>이제 이 시트에서 작업을 계속할 수 있습니다.</p>
        </div>
      )}
    </div>
  );
};

export default FieldMappingTool;
