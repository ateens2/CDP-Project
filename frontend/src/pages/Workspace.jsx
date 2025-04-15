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

  // 사용자 DB에 저장된 시트 id가 있다면 Google API를 통해 실제 파일 정보를 가져와 단일 시트 로그로 업데이트
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
          setSheets([newSheet]); // 단일 시트 로그 유지
          setSelectedSheet(newSheet);
        } catch (error) {
          console.error("Error retrieving file info:", error);
        }
      }
    };

    loadSheetInfo();
  }, [setSheets, sheets.length, user.sheet_file]); // 의존성 배열에서 sheets와 setSheets 제거

  // DriveSheetSelector에서 시트를 선택하면 바로 DB 업데이트 및 Google API 호출 수행
  const handleDriveSheetSelect = async (sheet) => {
    const newSheet = { name: sheet.name, sheetId: sheet.id };

    try {
      // 먼저 UI 상태 업데이트
      setSelectedSheet(newSheet);
      setShowDriveSelector(false);

      // DB 업데이트 요청
      const response = await fetch(`${backendUrl}/auth/google/updateSheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email || (user.emails && user.emails[0].value),
          sheet_file: newSheet.sheetId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update sheet information");
      }

      const data = await response.json();
      console.log("Sheet update response:", data);

      // 업데이트 후, Google Drive API에서 최신 파일 이름 조회
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

        // 상태 업데이트를 한 번에 처리
        setSheets([updatedSheet]);
      } else {
        console.error("Google API client not loaded.");
      }
    } catch (error) {
      console.error("Error updating sheet info in DB:", error);
      alert("시트 정보 업데이트에 실패했습니다.");
    }
  };

  // 시트 로그 항목 클릭 시, 즉시 고객 관리 화면(CustomerManagement)으로 이동
  const handleExistingSheetClick = (sheet) => {
    navigate("/customer-management", { state: { sheet } });
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
              // 단일 시트 로그 항목, 클릭 시 고객 관리 화면으로 이동
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
