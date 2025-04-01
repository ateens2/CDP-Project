// src/pages/Workspace.jsx
import { useContext } from "react";
import { UserContext } from "../contexts/UserContext";
import Header from "../components/Header";
import { UploadSheet } from "../api/UploadSheet";
import "./Workspace.css";

const Workspace = () => {
  const { user, sheets, setSheets } = useContext(UserContext);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        // UploadSheet 함수에 파일과 함께 로그인된 사용자의 이메일을 전달
        const data = await UploadSheet(file, user.email);
        // 백엔드가 { fileName: "업로드된 파일명", ... } 형태로 데이터를 반환한다고 가정
        setSheets((prevSheets) => [
          ...prevSheets,
          { name: data.fileName || file.name },
        ]);
      } catch (error) {
        console.error("File upload error:", error);
        alert("An error occurred during file upload.");
      }
    }
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
                <div key={index} className="sheet-item">
                  {sheet.name}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="box sheet-box">
          <h2 className="box-title">recently used</h2>
          <div className="sheet-list">
            {sheets.length === 0 ? (
              <p>No recently used sheets.</p>
            ) : (
              sheets.map((sheet, index) => (
                <div key={index} className="sheet-item">
                  {sheet.name}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <div className="add-button-container">
        <label htmlFor="fileUpload" className="upload-button">
          + Add Sheet
        </label>
        <input
          id="fileUpload"
          type="file"
          accept=".csv, .xlsx, application/vnd.google-apps.spreadsheet"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
};

export default Workspace;
