// src/pages/Workspace.jsx
import React, { useContext, useState } from "react";
import { UserContext } from "../contexts/UserContext";
import Header from "../components/Header";
import DriveSheetSelector from "../components/DriveSheetSelector";
import SheetEditor from "../components/SheetEditor";
import "./Workspace.css";

const Workspace = () => {
  const { user, sheets, setSheets } = useContext(UserContext);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [showDriveSelector, setShowDriveSelector] = useState(false);

  // DriveSheetSelector에서 사용자가 선택하면 그 시트를 state에 추가
  const handleDriveSheetSelect = (sheet) => {
    console.log("Selected sheet:", sheet);
    const newSheet = { name: sheet.name, sheetId: sheet.id };
    setSheets((prevSheets) => [...prevSheets, newSheet]);
    setShowDriveSelector(false);
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
