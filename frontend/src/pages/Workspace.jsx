// src/pages/Workspace.jsx
import React, { useContext, useState, useEffect } from "react";
import { UserContext } from "../contexts/UserContext";
import Header from "../components/Header";
import DriveSheetSelector from "../components/DriveSheetSelector";
import SheetEditor from "../components/SheetEditor";
import "./Workspace.css";

const Workspace = () => {
  const { user, sheets, setSheets } = useContext(UserContext);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [showDriveSelector, setShowDriveSelector] = useState(false);
  const backendUrl = import.meta.env.VITE_BACKEND_URL; // 예: http://localhost:3000

  // useEffect: 로그인한 사용자의 DB에 저장된 sheet_file(파일 ID)이 있으면, Google Drive API로 파일 정보를 가져와 sheets 배열에 추가
  useEffect(() => {
    if (user && user.sheet_file) {
      // 이미 추가되어 있지 않은 경우에만 처리
      if (!sheets.find((s) => s.sheetId === user.sheet_file)) {
        if (window.gapi && window.gapi.client) {
          // 먼저 drive API를 명시적으로 로드합니다.
          window.gapi.client.load("drive", "v3")
            .then(() => {
              return window.gapi.client.drive.files.get({
                fileId: user.sheet_file,
                fields: "id, name",
              });
            })
            .then((response) => {
              const fileData = response.result;
              const newSheet = { name: fileData.name, sheetId: fileData.id };
              setSheets((prevSheets) => [...prevSheets, newSheet]);
              setSelectedSheet(newSheet);
            })
            .catch((error) => {
              console.error("Error retrieving file info:", error);
              // 403 Forbidden이 발생하면, 해당 파일에 대한 접근 권한을 확인하세요.
            });
        } else {
          console.error("Google API client not loaded.");
        }
      }
    }
  }, [user, sheets, setSheets]);

  // 사용자가 DriveSheetSelector에서 시트를 선택하면 호출됨
  const handleDriveSheetSelect = async (sheet) => {
    const newSheet = { name: sheet.name, sheetId: sheet.id };
    setSheets((prevSheets) => [...prevSheets, newSheet]);
    setShowDriveSelector(false);

    // 백엔드에 사용자의 sheet_file 정보를 업데이트 요청
    try {
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
    } catch (error) {
      console.error("Error updating sheet info in DB:", error);
    }
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
        <div className="box sheet-box">
          <h2 className="box-title">sheets log</h2>
          <div className="sheet-list">
            {sheets.length === 0 ? (
              <p>No sheets yet.</p>
            ) : (
              sheets.map((sheet, index) => (
                <div
                  key={index}
                  className="sheet-item"
                  onClick={() => setSelectedSheet(sheet)}
                >
                  {sheet.name}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      <div className="add-button-container">
        <button
          className="upload-button"
          onClick={() => setShowDriveSelector(true)}
        >
          + Add Sheet
        </button>
      </div>
      {showDriveSelector && (
        <DriveSheetSelector
          onSelect={handleDriveSheetSelect}
          onCancel={() => setShowDriveSelector(false)}
        />
      )}
      {selectedSheet && <SheetEditor sheet={selectedSheet} />}
    </div>
  );
};

export default Workspace;
