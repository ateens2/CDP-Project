// src/components/SheetEditor.jsx
import React, { useEffect, useState } from "react";

const SheetEditor = ({ sheet }) => {
  const [sheetData, setSheetData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sheetMetadata, setSheetMetadata] = useState([]);
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const spreadsheetId = sheet.sheetId;
  const defaultRangeSuffix = "!A1:Z100";

  useEffect(() => {
    async function fetchSheetMetadata() {
      if (!window.gapi || !window.gapi.client) {
        alert("Google API 클라이언트가 로드되지 않았습니다.");
        return;
      }
      
      const tokenObj = window.gapi.client.getToken();
      if (!tokenObj || !tokenObj.access_token) {
        console.error("No access token available in gapi client.");
        return;
      }
      
      try {
        const response = await window.gapi.client.sheets.spreadsheets.get({
          spreadsheetId,
        });
        const metadata = response.result.sheets || [];
        setSheetMetadata(metadata);
        if (metadata.length > 0) {
          setSelectedSheetName(metadata[0].properties.title);
        }
      } catch (error) {
        console.error("Error fetching spreadsheet metadata:", error);
        alert("Failed to fetch spreadsheet metadata.");
      }
    }
    fetchSheetMetadata();
  }, [spreadsheetId]);

  useEffect(() => {
    async function fetchSheetData() {
      if (!window.gapi || !window.gapi.client) {
        alert("Google API 클라이언트가 로드되지 않았습니다.");
        return;
      }
      if (!selectedSheetName) return;
      
      const tokenObj = window.gapi.client.getToken();
      if (!tokenObj || !tokenObj.access_token) {
        console.error("No access token available in gapi client.");
        return;
      }
      
      const range = `${selectedSheetName}${defaultRangeSuffix}`;
      setIsLoading(true);
      try {
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });
        setSheetData(response.result.values || []);
      } catch (error) {
        console.error("Error fetching sheet data:", error);
        alert("Failed to fetch sheet data.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchSheetData();
  }, [spreadsheetId, selectedSheetName]);

  if (isLoading) return <div>Loading sheet data...</div>;

  return (
    <div className="sheet-editor">
      <h3>
        {sheet.name} Data (Tab: {selectedSheetName})
      </h3>
      {/* 시트 선택 드롭다운 렌더링 */}
      {sheetMetadata.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ marginRight: "0.5rem" }}>Select Sheet:</label>
          <select
            value={selectedSheetName}
            onChange={(e) => setSelectedSheetName(e.target.value)}
          >
            {sheetMetadata.map((meta) => (
              <option key={meta.properties.sheetId} value={meta.properties.title}>
                {meta.properties.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <table border="1" cellPadding="5">
        <tbody>
          {sheetData.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => (
                <td key={colIndex}>
                  <input
                    type="text"
                    value={cell}
                    onChange={(e) =>
                      setSheetData((prevData) => {
                        const newData = [...prevData];
                        if (!newData[rowIndex]) newData[rowIndex] = [];
                        newData[rowIndex][colIndex] = e.target.value;
                        return newData;
                      })
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={async () => {
        const range = `${selectedSheetName}${defaultRangeSuffix}`;
        try {
          await window.gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: "RAW",
            resource: { values: sheetData },
          });
          alert("Sheet updated successfully.");
        } catch (error) {
          console.error("Error updating sheet:", error);
          alert("Failed to update sheet.");
        }
      }}>
        Save Changes
      </button>
    </div>
  );
};

export default SheetEditor;
