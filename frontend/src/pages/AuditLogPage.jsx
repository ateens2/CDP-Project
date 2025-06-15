import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../contexts/UserContext';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import './AuditLogPage.css';

function AuditLogPage() {
  const [auditLog, setAuditLog] = useState([]);
  const [filterUserEmail, setFilterUserEmail] = useState('');
  const [filterUniqueID, setFilterUniqueID] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const { user, sheets } = useContext(UserContext);
  const navigate = useNavigate();
  const { state } = useLocation();

  // 스프레드시트 ID 가져오기 - state에서 우선 확인, 없으면 첫 번째 시트 사용
  const sheet = state?.sheet || (sheets && sheets.length > 0 ? sheets[0] : null);
  const spreadsheetId = sheet?.sheetId || user?.selectedSheetId || localStorage.getItem('selectedSpreadsheetId'); 

  useEffect(() => {
    console.log('AuditLogPage useEffect - 디버깅 정보:', {
      user: !!user,
      userRole: user?.role,
      sheets: sheets?.length,
      sheet: !!sheet,
      spreadsheetId: spreadsheetId
    });

    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    if (!spreadsheetId) {
        setError('스프레드시트가 선택되지 않았습니다. 먼저 고객 관리 페이지에서 시트를 선택해주세요.');
        setLoading(false);
        setAuditLog([]);
        return;
    }

    const fetchAuditLog = async () => {
      setLoading(true);
      setError(null);
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        let apiUrl = `${backendUrl}/api/auditlog/sheet/${spreadsheetId}`;
        const queryParams = [];
        if (filterUserEmail) queryParams.push(`userEmail=${encodeURIComponent(filterUserEmail)}`);
        if (filterUniqueID) queryParams.push(`UniqueID=${encodeURIComponent(filterUniqueID)}`);
        if (queryParams.length > 0) {
          apiUrl += `?${queryParams.join('&')}`;
        }
        
        console.log('감사 로그 API 호출:', apiUrl);
        
        const response = await axios.get(apiUrl, { withCredentials: true });
        
        console.log('감사 로그 응답:', response.data);
        
        // 데이터 형식 변환
        const formattedLog = (response.data.auditLog || []).map(entry => ({
          id: `${entry.Timestamp}-${entry.UniqueID}-${entry.FieldName}`,
          changed_at: entry.Timestamp,
          changed_by: entry.UserEmail,
          customer_unique_id: entry.UniqueID,
          field_name: entry.FieldName,
          old_value: entry.OldValue,
          new_value: entry.NewValue,
          sheet_name: entry.SheetName || 'Main'
        }));
        
        setAuditLog(formattedLog);
      } catch (err) {
        console.error("Error fetching audit log:", err);
        setError(err.response?.data?.message || 'Failed to fetch audit log from sheet');
        setAuditLog([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLog();
  }, [user, navigate, spreadsheetId, filterUserEmail, filterUniqueID, sheets]);

  const handleFilterUserEmailChange = (event) => {
    setFilterUserEmail(event.target.value);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로
  };
  
  const handleFilterUniqueIDChange = (event) => {
    setFilterUniqueID(event.target.value);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로
  };

  // 페이징 계산
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = auditLog.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(auditLog.length / itemsPerPage);

  if (!user || user.role !== 'admin') {
    return <p>Access Denied. Redirecting...</p>;
  }

  if (!spreadsheetId && !loading) {
    return (
      <div className="audit-log-page">
        <Header sheet={sheet} />
        <div className="audit-container">
          <div className="error-card">
            <div className="error-icon">⚠️</div>
            <h2>스프레드시트를 찾을 수 없습니다</h2>
            <p>먼저 고객 관리 페이지에서 스프레드시트를 선택해주세요.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="audit-log-page">
      <Header sheet={sheet} />
      <div className="audit-container">
        <div className="audit-header">
          <h1 className="audit-title">
            <span className="audit-icon">📋</span>
            감사 추적 로그
          </h1>
          <p className="audit-subtitle">고객 데이터 변경 이력을 조회할 수 있습니다</p>
        </div>

        {/* 필터 섹션 */}
        <div className="filter-section">
          <div className="filter-grid">
            <div className="filter-item">
              <label htmlFor="userEmail">사용자 이메일</label>
              <input 
                id="userEmail"
                type="text"
                placeholder="이메일로 필터링..."
                value={filterUserEmail}
                onChange={handleFilterUserEmailChange}
                className="filter-input"
              />
            </div>
            <div className="filter-item">
              <label htmlFor="UniqueID">고객 ID</label>
              <input 
                id="UniqueID"
                type="text"
                placeholder="고객 ID로 필터링..."
                value={filterUniqueID}
                onChange={handleFilterUniqueIDChange}
                className="filter-input"
              />
            </div>
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="loading-card">
            <div className="loading-spinner"></div>
            <p>감사 로그를 불러오는 중...</p>
          </div>
        )}

        {/* 에러 상태 */}
        {error && (
          <div className="error-card">
            <div className="error-icon">❌</div>
            <h3>오류 발생</h3>
            <p>{error}</p>
          </div>
        )}

        {/* 데이터 없음 상태 */}
        {!loading && !error && auditLog.length === 0 && (
          <div className="empty-card">
            <div className="empty-icon">📝</div>
            <h3>감사 로그가 없습니다</h3>
            <p>아직 기록된 변경 이력이 없습니다.</p>
          </div>
        )}

        {/* 데이터 테이블 */}
        {!loading && !error && auditLog.length > 0 && (
          <>
            <div className="data-summary">
              <span className="summary-text">
                총 {auditLog.length}개의 변경 이력
              </span>
              <span className="page-info">
                페이지 {currentPage} / {totalPages}
              </span>
            </div>

            <div className="table-container">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>날짜/시간</th>
                    <th>변경자</th>
                    <th>고객 ID</th>
                    <th>변경 필드</th>
                    <th>이전 값</th>
                    <th>새 값</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((logEntry) => (
                    <tr key={logEntry.id} className="audit-row">
                      <td className="timestamp-cell">
                        {new Date(logEntry.changed_at).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td className="user-cell">
                        <div className="user-info">
                          <div className="user-avatar">
                            {logEntry.changed_by.charAt(0).toUpperCase()}
                          </div>
                          <span className="user-email">{logEntry.changed_by}</span>
                        </div>
                      </td>
                      <td className="id-cell">
                        <code className="customer-id">{logEntry.customer_unique_id}</code>
                      </td>
                      <td className="field-cell">
                        <span className="field-name">{logEntry.field_name}</span>
                      </td>
                      <td className="value-cell old-value">
                        <div className="value-content">
                          {logEntry.old_value || <span className="empty-value">비어있음</span>}
                        </div>
                      </td>
                      <td className="value-cell new-value">
                        <div className="value-content">
                          {logEntry.new_value || <span className="empty-value">비어있음</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  이전
                </button>
                
                <div className="page-numbers">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`page-number ${currentPage === pageNumber ? 'active' : ''}`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AuditLogPage; 