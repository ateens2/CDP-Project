// src/pages/SheetEditor.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const SheetEditor = () => {
  const { state } = useLocation();
  const sheet = state?.sheet;
  const [sheetData, setSheetData] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [defaultSheetName, setDefaultSheetName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (sheet && window.gapi && window.gapi.client) {
      async function fetchSheetData() {
        try {
          // 먼저 스프레드시트 메타데이터를 가져와 기본 시트 이름을 확인
          const spreadsheetInfo =
            await window.gapi.client.sheets.spreadsheets.get({
              spreadsheetId: sheet.sheetId,
            });
          const sheetName = spreadsheetInfo.result.sheets[0].properties.title;
          setDefaultSheetName(sheetName);

          // 시트 이름에 공백이나 특수문자가 있으면 단 따옴표로 감싸기
          const range = `'${sheetName}'!A1:Z100`;
          const response =
            await window.gapi.client.sheets.spreadsheets.values.get({
              spreadsheetId: sheet.sheetId,
              range: range,
            });
          setSheetData(response.result.values || []);
        } catch (error) {
          console.error("Error fetching sheet data:", error);
          alert("시트 데이터를 가져오는데 실패했습니다.");
        }
      }
      fetchSheetData();
    }
  }, [sheet]);

  const handleCellClick = (rowIndex, colIndex, value) => {
    setEditingCell({ rowIndex, colIndex });
    setEditValue(value);
  };

  const handleCellChange = (e) => {
    setEditValue(e.target.value);
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;

    const { rowIndex, colIndex } = editingCell;
    const newData = [...sheetData];

    // 행이 없으면 빈 행 추가
    while (newData.length <= rowIndex) {
      newData.push([]);
    }

    // 열이 없으면 빈 열 추가
    while (newData[rowIndex].length <= colIndex) {
      newData[rowIndex].push("");
    }

    // 값 업데이트
    newData[rowIndex][colIndex] = editValue;
    setSheetData(newData);
    setEditingCell(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleCellBlur();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  const handleSave = async () => {
    if (!sheet || !defaultSheetName) return;

    setIsSaving(true);
    try {
      // 시트 이름에 공백이나 특수문자가 있으면 단 따옴표로 감싸기
      const range = `'${defaultSheetName}'!A1:Z100`;

      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: sheet.sheetId,
        range: range,
        valueInputOption: "RAW",
        resource: { values: sheetData },
      });

      alert("시트가 성공적으로 저장되었습니다.");
    } catch (error) {
      console.error("Error saving sheet data:", error);
      alert("시트 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    navigate("/");
  };

  if (!sheet) {
    return <div>선택된 시트가 없습니다.</div>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h2>{sheet.name} - 시트 편집기</h2>
        <div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              marginRight: "10px",
              padding: "8px 16px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
          <button
            onClick={handleBack}
            style={{
              padding: "8px 16px",
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            돌아가기
          </button>
        </div>
      </div>

      {sheetData ? (
        <div style={{ overflowX: "auto" }}>
          <table
            border="1"
            cellPadding="8"
            style={{ borderCollapse: "collapse", width: "100%" }}
          >
            <tbody>
              {sheetData.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      onClick={() => handleCellClick(rowIndex, cellIndex, cell)}
                      style={{
                        minWidth: "100px",
                        height: "30px",
                        padding: "0",
                        position: "relative",
                        backgroundColor:
                          editingCell?.rowIndex === rowIndex &&
                          editingCell?.colIndex === cellIndex
                            ? "#f0f0f0"
                            : "white",
                      }}
                    >
                      {editingCell?.rowIndex === rowIndex &&
                      editingCell?.colIndex === cellIndex ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={handleCellChange}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            padding: "5px",
                            boxSizing: "border-box",
                          }}
                        />
                      ) : (
                        <div style={{ padding: "5px" }}>{cell}</div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>시트 데이터를 불러오는 중...</p>
      )}
    </div>
  );
};

export default SheetEditor;
