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
      // Google API 에러 메시지가 errors 배열에 들어있으면 그것을, 아니면 err.message
      const apiError =
        err.errors && err.errors[0] && err.errors[0].message
          ? err.errors[0].message
          : err.message;
      // Google API 에러 코드(err.code)에 맞춰 상태코드 지정 (없으면 500)
      const statusCode = err.code && Number.isInteger(err.code) ? err.code : 500;
      res.status(statusCode).json({ message: apiError });
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

// --- 감사 로그를 위한 새로운 함수 및 라우트 ---

const CHANGE_HISTORY_SHEET_NAME = 'ChangeHistory';
const CHANGE_HISTORY_HEADERS = ['Timestamp', 'UserEmail', 'UniqueID', 'FieldName', 'OldValue', 'NewValue'];

// 'ChangeHistory' 시트 존재 확인 및 생성 함수
async function ensureChangeHistorySheetExists(sheets, spreadsheetId) {
  try {
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const historySheet = spreadsheetInfo.data.sheets.find(
      (s) => s.properties.title === CHANGE_HISTORY_SHEET_NAME
    );

    if (!historySheet) {
      console.log(`'${CHANGE_HISTORY_SHEET_NAME}' 시트가 없어 새로 생성합니다.`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            {
              addSheet: {
                properties: { title: CHANGE_HISTORY_SHEET_NAME },
              },
            },
          ],
        },
      });
      // 새 시트에 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${CHANGE_HISTORY_SHEET_NAME}'!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [CHANGE_HISTORY_HEADERS] },
      });
      console.log(`'${CHANGE_HISTORY_SHEET_NAME}' 시트 생성 및 헤더 추가 완료`);
    }
  } catch (error) {
    console.error(`시트 생성 중 오류 발생:`, error);
    throw error;
  }
}

// 변경 이력 기록 라우트
router.post('/record-change', async (req, res) => {
  console.log('record-change 요청 도착:', req.body);
  console.log('세션 정보:', req.user);
  console.log('인증 상태:', req.isAuthenticated());

  // 임시 해결책: 요청 본문에서 사용자 정보를 가져오거나 기본값 사용
  let userEmail = req.body.changedBy;
  let accessToken = null;

  if (req.isAuthenticated() && req.user) {
    console.log('세션 인증 성공');
    userEmail = req.user.email || req.body.changedBy;
    accessToken = req.user.accessToken;
  } else {
    console.log('세션 인증 실패, 요청 데이터에서 사용자 정보 사용');
    // 세션이 없을 경우, 별도 방법으로 Google API 접근
    // 프론트엔드에서 직접 Google API로 시트에 접근할 수 있으므로,
    // 여기서는 프론트엔드가 이미 시트를 수정한 후 이력만 기록하는 용도로 사용
  }

  const { spreadsheetId, sheetName, UniqueID, changedBy, changes } = req.body;

  if (!spreadsheetId || !UniqueID || !changedBy || !Array.isArray(changes) || changes.length === 0) {
    return res.status(400).json({ message: 'Spreadsheet ID, UniqueID, changedBy, and a non-empty array of changes are required.' });
  }

  try {
    // 세션 인증이 성공한 경우에만 Google API 사용
    if (accessToken) {
      console.log('Google API를 통해 ChangeHistory 시트에 직접 기록');
      
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      console.log('ChangeHistory 시트 확인 중...');
      await ensureChangeHistorySheetExists(sheets, spreadsheetId);

      const rowsToAppend = changes.map(change => [
        new Date().toISOString(), // Timestamp
        changedBy,               // UserEmail (변경자)
        UniqueID,                // UniqueID (고객 데이터 식별자)
        change.fieldName,        // FieldName
        String(change.oldValue), // OldValue (문자열로 변환)
        String(change.newValue)  // NewValue (문자열로 변환)
      ]);

      console.log('변경 이력 시트에 추가할 데이터:', rowsToAppend);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${CHANGE_HISTORY_SHEET_NAME}'!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: rowsToAppend },
      });

      console.log('변경 이력 기록 완료');
      res.status(200).json({ message: 'Change history recorded successfully via Google API.' });
    } else {
      console.log('Google API 접근 불가, MySQL에 변경 이력 기록');
      
      // MySQL에 변경 이력 기록 (백업 방법)
      const connection = await mysql.createConnection(mysqlConfig);
      
      for (const change of changes) {
        await connection.execute(
          `INSERT INTO customer_change_history 
           (spreadsheet_id, sheet_name, customer_unique_id, changed_by, field_name, old_value, new_value, changed_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            spreadsheetId,
            sheetName || 'Main',
            UniqueID,
            changedBy,
            change.fieldName,
            String(change.oldValue),
            String(change.newValue),
            new Date()
          ]
        );
      }
      
      await connection.end();
      console.log('MySQL에 변경 이력 기록 완료');
      res.status(200).json({ message: 'Change history recorded successfully in MySQL.' });
    }

  } catch (error) {
    console.error('Error recording change history:', error);
    const apiError =
      error.errors && error.errors[0] && error.errors[0].message
        ? error.errors[0].message
        : error.message;
    const statusCode = error.code && Number.isInteger(error.code) ? error.code : 500;
    res.status(statusCode || 500).json({ message: 'Failed to record change history.', error: apiError });
  }
});

// --- 감사 로그 조회 라우트는 auditLog.js로 이동했으므로 여기서는 제거 또는 주석 처리합니다. ---
// router.get('/auditlog/sheet/:spreadsheetId', async (req, res) => { ... });

// 세션 상태 확인용 디버깅 엔드포인트
router.get('/debug-session', (req, res) => {
  console.log('=== 세션 디버깅 정보 ===');
  console.log('req.isAuthenticated():', req.isAuthenticated());
  console.log('req.user:', req.user);
  console.log('req.session:', req.session);
  console.log('req.sessionID:', req.sessionID);
  console.log('========================');
  
  res.json({
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
    sessionID: req.sessionID,
    hasAccessToken: !!(req.user && req.user.accessToken)
  });
});

module.exports = router; 