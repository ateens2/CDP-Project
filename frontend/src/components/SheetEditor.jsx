// src/pages/SheetEditor.jsx
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const SheetEditor = () => {
  const { state } = useLocation();
  const sheet = state?.sheet;
  const [sheetData, setSheetData] = useState(null);

  useEffect(() => {
    if (sheet && window.gapi && window.gapi.client) {
      async function fetchSheetData() {
        try {
          // 먼저 스프레드시트 메타데이터를 가져와 기본 시트 이름을 확인
          const spreadsheetInfo = await window.gapi.client.sheets.spreadsheets.get({
            spreadsheetId: sheet.sheetId,
          });
          const defaultSheetName = spreadsheetInfo.result.sheets[0].properties.title;
          // 시트 이름에 공백이나 특수문자가 있으면 단 따옴표로 감싸기
          const range = `'${defaultSheetName}'!A1:Z100`;
          const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: sheet.sheetId,
            range: range,
          });
          setSheetData(response.result.values);
        } catch (error) {
          console.error("Error fetching sheet data:", error);
          alert("fail to fetch");
        }
      }
      fetchSheetData();
    }
  }, [sheet]);

  if (!sheet) {
    return <div>No sheet selected.</div>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>{sheet.name} - Sheet Editor</h2>
      {sheetData ? (
        <table border="1" cellPadding="8">
          <tbody>
            {sheetData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Loading sheet data...</p>
      )}
    </div>
  );
};

export default SheetEditor;
