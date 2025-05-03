// src/pages/Workspace.jsx
import React, { useContext, useState, useEffect } from "react";
import { UserContext } from "../contexts/UserContext";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import DriveSheetSelector from "../components/DriveSheetSelector";
import FieldMappingTool from "../components/FieldMappingTool";
import "./Workspace.css";

const Workspace = () => {
  const { user, sheets, setSheets } = useContext(UserContext);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [showDriveSelector, setShowDriveSelector] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const navigate = useNavigate();

  useEffect(() => {
    const loadSheetInfo = async () => {
      if (user?.sheet_file && sheets.length === 0 && window.gapi?.client) {
        try {
          await window.gapi.client.load("drive", "v3");
          const response = await window.gapi.client.drive.files.get({
            fileId: user.sheet_file,
            fields: "id, name",
          });
          const fileData = response.result;
          const newSheet = { name: fileData.name, sheetId: fileData.id };
          setSheets([newSheet]);
          setSelectedSheet(newSheet);
        } catch (error) {
          console.error("Error retrieving file info:", error);
        }
      }
    };
    loadSheetInfo();
  }, [setSheets, sheets.length, user.sheet_file]);

  const handleDriveSheetSelect = async (sheet) => {
    const newSheet = { name: sheet.name, sheetId: sheet.id };
    try {
      setSelectedSheet(newSheet);
      setShowDriveSelector(false);
      const response = await fetch(`${backendUrl}/auth/google/updateSheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email || (user.emails && user.emails[0].value),
          sheet_file: newSheet.sheetId,
        }),
      });
      if (!response.ok) throw new Error("Failed to update sheet information");
      const data = await response.json();
      console.log("Sheet update response:", data);
      if (window.gapi && window.gapi.client) {
        await window.gapi.client.load("drive", "v3");
        const driveResponse = await window.gapi.client.drive.files.get({
          fileId: newSheet.sheetId,
          fields: "id, name",
        });
        const updatedSheet = {
          name: driveResponse.result.name,
          sheetId: driveResponse.result.id,
        };
        setSheets([updatedSheet]);
      }
    } catch (error) {
      console.error("Error updating sheet info in DB:", error);
      alert("시트 정보 업데이트에 실패했습니다.");
    }
  };

  const handleExistingSheetClick = (sheet) => {
    navigate("/customer-management", { state: { sheet } });
  };

  const handleFieldMappingComplete = (result) => {
    console.log("Field mapping completed:", result);
    // 필요한 경우 여기서 추가 처리
  };

  if (!user) {
    return (
      <div className="workspace-unauthorized">
        <Header />
        <h2>Please login first.</h2>
      </div>
    );
  }

  return (
    <div className="workspace-container">
      <Header />
      <main className="workspace-content">
        <h1 className="workspace-title">워크스페이스</h1>

        {/* 연결된 스프레드시트 표시 */}
        <section className="workspace-section">
          <h2 className="section-title">연결된 스프레드시트</h2>
          <div className="sheet-selection-area">
            {sheets.length > 0 ? (
              <div className="existing-sheet-wrapper">
                <div className="existing-sheet-info">
                  {sheets.map((sheet, index) => (
                    <div key={index} className="existing-sheet-item">
                      <div className="sheet-icon">📊</div>
                      <div className="sheet-details">
                        <div className="sheet-name">{sheet.name}</div>
                        <div className="sheet-id">ID: {sheet.sheetId}</div>
                      </div>
                      <div className="sheet-actions">
                        <button className="sheet-action-btn" onClick={() => handleExistingSheetClick(sheet)}>
                          <span>고객 관리</span>
                        </button>
                        <button className="sheet-action-btn" onClick={() => setShowFieldMapping(!showFieldMapping)}>
                          <span>{showFieldMapping ? "필드 매핑 닫기" : "AI 필드 매핑"}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="change-sheet-btn"
                  onClick={() => setShowDriveSelector(true)}
                >
                  다른 스프레드시트 선택
                </button>
              </div>
            ) : (
              <div className="no-sheet-wrapper">
                <p>연결된 스프레드시트가 없습니다.</p>
                <button
                  className="select-sheet-btn"
                  onClick={() => setShowDriveSelector(true)}
                >
                  Google Drive에서 스프레드시트 선택
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 필드 매핑 도구 */}
        {showFieldMapping && selectedSheet && (
          <section className="workspace-section field-mapping-section">
            <FieldMappingTool 
              sheet={selectedSheet}
              onMapComplete={handleFieldMappingComplete}
            />
          </section>
        )}

        {/* 도움말 섹션 */}
        <section className="workspace-section help-section">
          <div className="help-header" onClick={() => setShowHelp(!showHelp)}>
            <h2 className="section-title">도움말 및 사용법</h2>
            <span className="toggle-icon">{showHelp ? "▲" : "▼"}</span>
          </div>
          {showHelp && (
            <div className="help-content">
              <div className="help-item">
                <h3>스프레드시트 연결하기</h3>
                <p>
                  "Google Drive에서 스프레드시트 선택" 버튼을 클릭하여 기존
                  고객 데이터가 있는 스프레드시트를 선택하세요.
                </p>
              </div>
              <div className="help-item">
                <h3>AI 필드 매핑</h3>
                <p>
                  스프레드시트의 열 이름이 표준 형식과 다른 경우, AI 필드 매핑 기능을
                  사용하면 자동으로 열 이름을 감지하고 표준 필드로 매핑합니다.
                </p>
              </div>
              <div className="help-item">
                <h3>고객 관리</h3>
                <p>
                  고객 관리 버튼을 클릭하면 연결된 스프레드시트의 고객 정보를
                  조회, 관리할 수 있는 대시보드로 이동합니다.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* 드라이브 시트 선택기 모달 */}
      {showDriveSelector && (
        <div className="modal-overlay">
          <div className="modal-content">
            <DriveSheetSelector
              onSelect={handleDriveSheetSelect}
              onCancel={() => setShowDriveSelector(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Workspace;
