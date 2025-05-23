// src/components/DriveSheetSelector.jsx
import React, { useEffect, useState } from "react";
import "./DriveSheetSelector.css";

const DriveSheetSelector = ({ onSelect, onCancel }) => {
  const [driveSheets, setDriveSheets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDriveSheets() {
      if (!window.gapi || !window.gapi.client) {
        alert("Google API 클라이언트가 로드되지 않았습니다.");
        setLoading(false);
        return;
      }

      const tokenObj = window.gapi.client.getToken();
      if (!tokenObj || !tokenObj.access_token) {
        console.error("No access token available in gapi client.");
        setLoading(false);
        return;
      }

      try {
        const response = await window.gapi.client.drive.files.list({
          q: "mimeType='application/vnd.google-apps.spreadsheet'",
          fields: "files(id, name)",
        });
        console.log("Drive API response:", response.result.files);
        setDriveSheets(response.result.files);
      } catch (error) {
        console.error("Error fetching drive sheets:", error);
        alert("Failed to fetch spreadsheets from Google Drive.");
      } finally {
        setLoading(false);
      }
    }
    fetchDriveSheets();
  }, []);

  if (loading) return <div>Loading spreadsheets...</div>;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Select a Spreadsheet from Google Drive</h3>
        <ul>
          {driveSheets.map((sheet) => (
            <li key={sheet.id} className={`sheet-item`}>
              <button onClick={() => onSelect(sheet)}>{sheet.name}</button>
              <span className="sheet-item-icon">📄</span>
              <div className="sheet-item-info">
                <span className="sheet-item-meta">{sheet.ownerEmail}</span>
              </div>
            </li>
          ))}
        </ul>
        <button className="cancel-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default DriveSheetSelector;
