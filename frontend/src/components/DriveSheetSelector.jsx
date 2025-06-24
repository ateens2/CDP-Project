import React, { useState, useEffect } from 'react';
import './DriveSheetSelector.css';

const DriveSheetSelector = ({ onSelectSheet }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false); // 초기값을 false로 변경
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Google API가 준비되면 자동으로 로드
    const checkAndLoadFiles = () => {
      if (window.gapi && window.gapi.client && window.gapi.client.drive) {
        loadDriveFiles();
      } else {
        // Google API가 없으면 더미 파일 표시
        setFiles([
          {
            id: 'dummy_1',
            name: '더미 스프레드시트 1',
            modifiedTime: new Date().toISOString(),
            mimeType: 'application/vnd.google-apps.spreadsheet'
          },
          {
            id: 'dummy_2', 
            name: '더미 스프레드시트 2',
            modifiedTime: new Date().toISOString(),
            mimeType: 'application/vnd.google-apps.spreadsheet'
          }
        ]);
        setLoading(false);
      }
    };

    // 3초 후에 확인
    const timeout = setTimeout(checkAndLoadFiles, 3000);
    
    return () => clearTimeout(timeout);
  }, []);

  const loadDriveFiles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (window.gapi && window.gapi.client && window.gapi.client.drive) {
        const response = await window.gapi.client.drive.files.list({
          q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
          fields: 'files(id,name,modifiedTime,mimeType)',
          orderBy: 'modifiedTime desc',
          pageSize: 50
        });

        if (response.result && response.result.files) {
          setFiles(response.result.files);
        } else {
          setFiles([]);
        }
      } else {
        throw new Error('Google Drive API가 초기화되지 않았습니다.');
      }
    } catch (err) {
      console.error('파일 목록 로드 오류:', err);
      setError('파일 목록을 불러오는데 실패했습니다: ' + err.message);
      
      // 오류 발생 시 더미 데이터 사용
      setFiles([
        {
          id: 'dummy_fallback',
          name: '기본 스프레드시트',
          modifiedTime: new Date().toISOString(),
          mimeType: 'application/vnd.google-apps.spreadsheet'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
  };

  const handleConfirmSelection = () => {
    if (selectedFile && onSelectSheet) {
      onSelectSheet(selectedFile);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="drive-sheet-selector">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Google Drive에서 스프레드시트를 검색하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="drive-sheet-selector">
      <h2>Google Drive 스프레드시트 선택</h2>
      
      <input
        type="text"
        placeholder="파일명으로 검색..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-box"
      />

      <button onClick={loadDriveFiles} className="refresh-button">
        새로고침
      </button>

      {error && (
        <div className="error">
          <p>{error}</p>
          <p style={{fontSize: '14px', marginTop: '10px'}}>
            더미 데이터로 계속 진행합니다.
          </p>
        </div>
      )}

      {filteredFiles.length === 0 ? (
        <div className="no-files">
          {files.length === 0 
            ? "Google Drive에 스프레드시트가 없습니다."
            : "검색 결과가 없습니다."
          }
        </div>
      ) : (
        <div className="file-list">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
              onClick={() => handleFileSelect(file)}
            >
              <div className="file-name">{file.name}</div>
              <div className="file-modified">
                수정일: {formatDate(file.modifiedTime)}
              </div>
              <div className="file-type">
                {file.id.includes('dummy') ? 'Dummy Sheet' : 'Google Sheets'}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedFile && (
        <button
          onClick={handleConfirmSelection}
          className="select-button"
        >
          '{selectedFile.name}' 선택하기
        </button>
      )}
    </div>
  );
};

export default DriveSheetSelector; 