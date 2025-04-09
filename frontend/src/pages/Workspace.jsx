// src/pages/Workspace.jsx
import React, { useContext, useState, useEffect, useCallback } from "react";
import { UserContext } from "../contexts/UserContext";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import DriveSheetSelector from "../components/DriveSheetSelector";
import "./Workspace.css";

const Workspace = () => {
  const { user, sheets, setSheets } = useContext(UserContext);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [showDriveSelector, setShowDriveSelector] = useState(false);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  const navigate = useNavigate();

  // 초기 시트 정보 로드
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
  }, [user?.sheet_file, sheets.length, setSheets, setSelectedSheet]);

  // DriveSheetSelector에서 시트를 선택하면 DB 업데이트 및 Google Drive API 호출로 바로 시트 정보 반영
  const handleDriveSheetSelect = async (sheet) => {
    const newSheet = { name: sheet.name, sheetId: sheet.id };

    try {
      // DB 업데이트 요청
      const response = await fetch(`${backendUrl}/auth/google/updateSheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email || (user.emails && user.emails[0].value),
          sheet_file: newSheet.sheetId,
        }),
      });
      const data = await response.json();
      console.log("Sheet update response:", data);

      // DB 업데이트가 성공하면 상태 업데이트
      setSheets([newSheet]);
      setSelectedSheet(newSheet);
    } catch (error) {
      console.error("Error updating sheet info in DB:", error);
      alert("fail to fetch");
    }

    setShowDriveSelector(false);
  };

  // 기존 시트 로그의 시트 이름을 클릭하면 SheetEditor 화면으로 전환하여 시트를 편집
  const handleExistingSheetClick = (sheet) => {
    navigate("/sheet-editor", { state: { sheet } });
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
    <div className="workspace">
      <Header />
      <main className="main">
        <div
          className={`box sheet-box ${showDriveSelector ? "slide-left" : ""}`}
        >
          <h2 className="box-title">sheets log</h2>
          <div className="sheet-list">
            {sheets.length === 0 ? (
              <p>No sheets yet.</p>
            ) : (
              sheets.map((sheet, index) => (
                <div
                  key={index}
                  className="sheet-item"
                  onClick={() => handleExistingSheetClick(sheet)}
                >
                  {sheet.name}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      <div
        className={`add-button-container ${showDriveSelector ? "moved" : ""}`}
      >
        <button
          className="upload-button"
          onClick={() => setShowDriveSelector(true)}
        >
          {sheets.length > 0 ? "Update" : "+ Add Sheet"}
        </button>
      </div>
      {showDriveSelector && (
        <div className="drive-sheet-selector-container open">
          <DriveSheetSelector
            onSelect={handleDriveSheetSelect}
            onCancel={() => setShowDriveSelector(false)}
          />
        </div>
      )}
    </div>
  );
};

export default Workspace;
