// src/components/DriveSheetSelector.jsx
import React, { useEffect, useState } from "react";

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
    <div className="drive-sheet-selector">
      <h3>Select a Spreadsheet from Google Drive</h3>
      <ul>
        {driveSheets.map((sheet) => (
          <li key={sheet.id}>
            <button onClick={() => onSelect(sheet)}>{sheet.name}</button>
          </li>
        ))}
      </ul>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
};

export default DriveSheetSelector;
