// src/pages/Workspace.jsx
import React, { useContext, useState, useEffect } from "react";
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

  // DB에 저장된 시트 정보가 있으면 Google API를 통해 실제 파일 제목을 가져와 단일 시트 로그로 저장
  useEffect(() => {
    if (user && user.sheet_file) {
      // sheets 배열이 빈 상태이면 반드시 Drive API를 호출해서 최신 파일 정보를 받아옴
      if (!sheets.find((s) => s.sheetId === user.sheet_file)) {
        if (window.gapi && window.gapi.client) {
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
              setSheets([newSheet]);  // 단일 시트 로그만 유지
              setSelectedSheet(newSheet);
            })
            .catch((error) => {
              console.error("Error retrieving file info:", error);
            });
        } else {
          console.error("Google API client not loaded.");
        }
      }
    }
  }, [user, sheets, setSheets]);

  // DriveSheetSelector에서 시트를 선택하면 DB 업데이트 및 Google Drive API 호출로 바로 시트 정보 반영
  const handleDriveSheetSelect = async (sheet) => {
    const newSheet = { name: sheet.name, sheetId: sheet.id };
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
      setSelectedSheet(updatedSheet);
    } else {
      console.error("Google API client not loaded.");
    }
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

    } catch (error) {
      console.error("Error updating sheet info in DB:", error);
      alert("fail to fetch");
    }
    // 시트 목록 컨테이너 닫기
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
        <div className={`box sheet-box ${showDriveSelector ? "slide-left" : ""}`}>
          <h2 className="box-title">sheets log</h2>
          <div className="sheet-list">
            {sheets.length === 0 ? (
              <p>No sheets yet.</p>
            ) : (
              // 단일 시트 로그로 표시하며, 클릭 시 SheetEditor 화면으로 전환
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
      <div className={`add-button-container ${showDriveSelector ? "moved" : ""}`}>
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
