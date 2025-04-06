// src/components/SheetEditor.jsx
import React, { useEffect, useState } from "react";

const SheetEditor = ({ sheet }) => {
  const [sheetData, setSheetData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sheetMetadata, setSheetMetadata] = useState([]); // 모든 시트(탭) 메타데이터
  const [selectedSheetName, setSelectedSheetName] = useState(""); // 사용자가 선택한 시트 이름
  // spreadsheetId: DriveSheetSelector에서 받아온 값 (실제 Google 스프레드시트 ID)
  const spreadsheetId = sheet.sheetId; // 반드시 실제 유효한 ID여야 함.
  // 기본 범위: 시트 이름 뒤에 셀 범위를 지정 (필요에 따라 수정)
  const defaultRangeSuffix = "!A1:Z100";

  // 1. 스프레드시트 메타데이터 가져오기: 각 시트(탭)의 정보를 불러와서 드롭다운에 표시
  useEffect(() => {
    async function fetchSheetMetadata() {
      if (!window.gapi || !window.gapi.client) {
        alert("Google API 클라이언트가 로드되지 않았습니다.");
        return;
      }
      try {
        const response = await window.gapi.client.sheets.spreadsheets.get({
          spreadsheetId,
        });
        const metadata = response.result.sheets || [];
        setSheetMetadata(metadata);
        if (metadata.length > 0) {
          // 기본값으로 첫 번째 시트의 title을 사용
          setSelectedSheetName(metadata[0].properties.title);
        }
      } catch (error) {
        console.error("Error fetching spreadsheet metadata:", error);
        alert("Failed to fetch spreadsheet metadata.");
      }
    }
    fetchSheetMetadata();
  }, [spreadsheetId]);

  // 2. 선택된 시트 이름에 따라 데이터를 가져오기
  useEffect(() => {
    async function fetchSheetData() {
      if (!window.gapi || !window.gapi.client) {
        alert("Google API 클라이언트가 로드되지 않았습니다.");
        return;
      }
      if (!selectedSheetName) return; // 시트 이름이 정해지지 않았다면 아무것도 하지 않음.
      const range = `${selectedSheetName}${defaultRangeSuffix}`;
      setIsLoading(true);
      try {
        const response =
          await window.gapi.client.sheets.spreadsheets.values.get({
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

  // 드롭다운에서 시트를 선택할 수 있도록 렌더링하는 함수
  const renderSheetSelector = () => {
    if (sheetMetadata.length === 0) return null;
    return (
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
    );
  };

  // 셀 데이터 변경 처리
  const handleCellChange = (rowIndex, colIndex, value) => {
    const newData = [...sheetData];
    if (!newData[rowIndex]) newData[rowIndex] = [];
    newData[rowIndex][colIndex] = value;
    setSheetData(newData);
  };

  // 수정된 데이터를 저장하는 함수: 선택된 시트에 업데이트
  const handleSave = async () => {
    if (!window.gapi || !window.gapi.client) {
      alert("Google API 클라이언트가 로드되지 않았습니다.");
      return;
    }
    const range = `${selectedSheetName}${defaultRangeSuffix}`;
    try {
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW", // 또는 "USER_ENTERED"로 변경 가능
        resource: { values: sheetData },
      });
      alert("Sheet updated successfully.");
    } catch (error) {
      console.error("Error updating sheet:", error);
      alert("Failed to update sheet.");
    }
  };

  if (isLoading) return <div>Loading sheet data...</div>;

  return (
    <div className="sheet-editor">
      <h3>
        {sheet.name} Data (Tab: {selectedSheetName})
      </h3>
      {renderSheetSelector()}
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
                      handleCellChange(rowIndex, colIndex, e.target.value)
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={handleSave}>Save Changes</button>
    </div>
  );
};

export default SheetEditor;
