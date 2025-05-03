require('dotenv').config();
const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

// MySQL 연결 설정
const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  namedPlaceholders: true,
};

// 스프레드시트의 열 정보 가져오기
router.get('/headers', async (req, res) => {
  const { spreadsheetId } = req.query;
  
  if (!spreadsheetId) {
    return res.status(400).json({ message: 'Spreadsheet ID is required' });
  }

  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Google Sheets API 클라이언트 생성
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: req.user.accessToken });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // 스프레드시트 메타데이터 가져오기
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    // 첫 번째 시트의 이름 가져오기
    const sheetName = spreadsheetInfo.data.sheets[0].properties.title;

    // 열 정보 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!1:1`,
    });

    const headers = response.data.values ? response.data.values[0] : [];
    
    return res.json({ headers, sheetName });
  } catch (error) {
    console.error('Error fetching sheet headers:', error.message);
    return res.status(500).json({ message: 'Error fetching sheet headers', error: error.message });
  }
});

// AI 필드 매핑 실행
router.post('/map-fields', async (req, res) => {
  const { spreadsheetId, headers } = req.body;
  
  if (!spreadsheetId || !headers || !headers.length) {
    return res.status(400).json({ message: 'Spreadsheet ID and headers are required' });
  }

  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // 임시 CSV 파일 생성 (AI 모델에 입력하기 위함)
    const tempCsvPath = path.join(__dirname, '..', 'temp', `temp_headers_${Date.now()}.csv`);
    
    // 임시 디렉토리 확인 및 생성
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // CSV 파일에 헤더만 기록
    fs.writeFileSync(tempCsvPath, headers.join(',') + '\n');
    
    // Python AI 스크립트 실행
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [
        path.join(__dirname, '..', '..', 'ai', 'main.py'),
        tempCsvPath
      ]);
      
      let mappingResult = '';
      let errorOutput = '';
      
      // 표준 출력 데이터 수집
      pythonProcess.stdout.on('data', (data) => {
        mappingResult += data.toString();
      });
      
      // 표준 에러 수집
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      // 프로세스 종료 시 처리
      pythonProcess.on('close', async (code) => {
        // 임시 파일 삭제
        if (fs.existsSync(tempCsvPath)) {
          fs.unlinkSync(tempCsvPath);
        }
        
        if (code !== 0) {
          console.error('AI 프로세스 오류:', errorOutput);
          return reject(new Error(`AI process exited with code ${code}: ${errorOutput}`));
        }
        
        try {
          // 매핑 결과 파싱
          const mappingData = parseMappingOutput(mappingResult);
          
          // 매핑된 필드로 새로운 시트 생성
          const oauth2Client = new google.auth.OAuth2();
          oauth2Client.setCredentials({ access_token: req.user.accessToken });
          const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
          
          // 스프레드시트 메타데이터 가져오기
          const spreadsheetInfo = await sheets.spreadsheets.get({
            spreadsheetId,
          });
          
          // 첫 번째 시트 이름 가져오기
          const originalSheetName = spreadsheetInfo.data.sheets[0].properties.title;
          
          // 매핑된 시트 이름 생성
          const mappedSheetName = 'Mapped_Data';
          
          // 기존 데이터 가져오기
          const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${originalSheetName}'!A:Z`,
          });
          
          const originalData = dataResponse.data.values || [[]];
          
          // 새로운 시트 생성
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
              requests: [{
                addSheet: {
                  properties: {
                    title: mappedSheetName,
                  }
                }
              }]
            }
          });
          
          // 매핑된 헤더 생성
          const mappedHeaders = headers.map(header => {
            const mapping = mappingData.find(m => m.originalField === header);
            return mapping ? mapping.standardField : header;
          });
          
          // 새 시트에 데이터 쓰기 (원본 데이터의 첫 번째 행을 매핑된 헤더로 대체)
          const mappedData = [mappedHeaders, ...originalData.slice(1)];
          
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${mappedSheetName}'!A1`,
            valueInputOption: 'RAW',
            resource: {
              values: mappedData
            }
          });
          
          resolve({
            mappingData,
            message: '필드 매핑 및 새 시트 생성이 완료되었습니다.',
            newSheetName: mappedSheetName
          });
        } catch (err) {
          reject(err);
        }
      });
    })
    .then(result => {
      res.json(result);
    })
    .catch(err => {
      console.error('Error in field mapping process:', err);
      res.status(500).json({ message: err.message });
    });
  } catch (error) {
    console.error('Error mapping fields:', error);
    return res.status(500).json({ message: 'Error mapping fields', error: error.message });
  }
});

// AI 출력 결과 파싱 함수
function parseMappingOutput(output) {
  const mappingResults = [];
  const lines = output.split('\n');
  
  // "필드 매핑 결과:" 이후의 라인만 처리
  let resultStarted = false;
  
  for (const line of lines) {
    if (line.includes('필드 매핑 결과:')) {
      resultStarted = true;
      continue;
    }
    
    if (resultStarted && line.includes('→')) {
      // "원본필드 → 표준필드 (유사도: 0.xxxx)" 형식 파싱
      const parts = line.split('→');
      if (parts.length === 2) {
        const originalField = parts[0].trim();
        const secondPart = parts[1].trim(); // "표준필드 (유사도: 0.xxxx)"
        
        const scoreMatch = secondPart.match(/\(유사도: ([\d.]+)\)/);
        const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
        
        const standardField = secondPart.replace(/\(유사도: [\d.]+\)/, '').trim();
        
        mappingResults.push({
          originalField,
          standardField,
          score
        });
      }
    }
  }
  
  return mappingResults;
}

module.exports = router; 