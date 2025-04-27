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
  const [showHelp, setShowHelp] = useState(false); // ← 도움말 토글 상태
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

          {/* 도움말 아이콘 */}
          <i
            className="fa-regular fa-circle-question sheet-help-icon"
            title="사용설명 보기"
            onClick={() => setShowHelp((v) => !v)}
          />

          {/* 토글용 읽기 전용 textarea */}
          {showHelp && (
            <textarea
              className="help-textarea"
              readOnly
              value={`
1. 시트 로그 하단의 ‘Add Sheet’ 버튼을 누르면 구글 드라이브를 통해 모든 구글 시트가 나옵니다.\n
2. 구글 시트 목록에서 관리하는 고객 시트를 등록해주세요\n
3. 구글 시트가 등록이 완료되고 버튼 클릭 시 ai를 통해 파편화 정리가 진행됩니다. \n\n *파편화가 정리된 시트로 새로 생성되는 것이니 기존의 시트는 그대로 있습니다.\n
4. ‘Update’ 버튼으로 다른 시트로도 변경 가능합니다.\n
5. 시트 항목을 클릭하면 고객 관리 화면으로 이동합니다.`}
            />
          )}

          <div className="sheet-list">
            {sheets.length === 0 ? (
              <p>No sheets yet.</p>
            ) : (
              sheets.map((sheet, index) => (
                <div
                  key={index}
                  className="sheet-item"
                  title="시트 관리로 이동하기"
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
