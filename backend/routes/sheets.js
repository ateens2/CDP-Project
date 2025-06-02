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
          // 새로운 매핑 결과 파싱
          const { salesMapping, customerMapping } = parseNewMappingOutput(mappingResult);
          
          // Google Sheets API 설정
          const oauth2Client = new google.auth.OAuth2();
          oauth2Client.setCredentials({ access_token: req.user.accessToken });
          const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
          
          // 스프레드시트 메타데이터 가져오기
          const spreadsheetInfo = await sheets.spreadsheets.get({
            spreadsheetId,
          });
          
          // 첫 번째 시트 이름 가져오기
          const originalSheetName = spreadsheetInfo.data.sheets[0].properties.title;
          
          // 기존 데이터 가져오기
          const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${originalSheetName}'!A:Z`,
          });
          
          const originalData = dataResponse.data.values || [[]];
          const originalHeaders = originalData[0] || [];
          const originalRows = originalData.slice(1);
          
          // 두 개의 새 시트 생성 또는 기존 시트 확인
          const salesSheetName = '제품_판매_기록';
          const customerSheetName = '고객_정보';
          
          // 기존 시트 확인
          const existingSheets = spreadsheetInfo.data.sheets.map(sheet => sheet.properties.title);
          const salesSheetExists = existingSheets.includes(salesSheetName);
          const customerSheetExists = existingSheets.includes(customerSheetName);
          
          // 새로 생성할 시트들만 추가
          const sheetsToCreate = [];
          if (!salesSheetExists) {
            sheetsToCreate.push({
              addSheet: {
                properties: { title: salesSheetName }
              }
            });
          }
          if (!customerSheetExists) {
            sheetsToCreate.push({
              addSheet: {
                properties: { title: customerSheetName }
              }
            });
          }
          
          // 새 시트가 있는 경우에만 생성 요청
          if (sheetsToCreate.length > 0) {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              resource: {
                requests: sheetsToCreate
              }
            });
          }
          
          // 제품 판매 기록 시트 데이터 생성
          const salesData = createSalesSheetData(originalHeaders, originalRows, salesMapping);
          
          // 고객 정보 시트 데이터 생성
          const customerData = createCustomerSheetData(originalHeaders, originalRows, customerMapping);
          
          // 제품 판매 기록 시트에 데이터 쓰기 (기존 데이터 덮어쓰기)
          // 먼저 기존 데이터 영역을 모두 지움
          await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `'${salesSheetName}'!A:Z`,
          });
          
          // 새 데이터 쓰기
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${salesSheetName}'!A1`,
            valueInputOption: 'RAW',
            resource: {
              values: salesData
            }
          });
          
          // 고객 정보 시트에 데이터 쓰기 (기존 데이터 덮어쓰기)
          // 먼저 기존 데이터 영역을 모두 지움
          await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `'${customerSheetName}'!A:Z`,
          });
          
          // 새 데이터 쓰기
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${customerSheetName}'!A1`,
            valueInputOption: 'RAW',
            resource: {
              values: customerData
            }
          });
          
          // 고객별 구매 통계 계산 및 업데이트
          console.log('고객별 구매 통계 계산 시작...');
          await calculateCustomerPurchaseStats(sheets, spreadsheetId, salesSheetName, customerSheetName);
          console.log('고객별 구매 통계 계산 완료');
          
          // 고객별 탄소 감축 점수 및 등급 계산
          console.log('고객별 탄소 감축 점수 및 등급 계산 시작...');
          await calculateCarbonReductionStats(sheets, spreadsheetId, salesSheetName, customerSheetName);
          console.log('고객별 탄소 감축 점수 및 등급 계산 완료');
          
          // 결과 메시지 생성
          let message = '';
          if (sheetsToCreate.length === 2) {
            message = '제품 판매 기록 및 고객 정보 시트가 성공적으로 생성되고, 구매 통계 및 탄소 감축 점수가 계산되었습니다.';
          } else if (sheetsToCreate.length === 1) {
            const createdSheetName = sheetsToCreate[0].addSheet.properties.title;
            message = `${createdSheetName} 시트가 새로 생성되고, 기존 시트가 업데이트되었으며, 구매 통계 및 탄소 감축 점수가 계산되었습니다.`;
          } else {
            message = '기존 제품 판매 기록 및 고객 정보 시트가 성공적으로 업데이트되고, 구매 통계 및 탄소 감축 점수가 재계산되었습니다.';
          }
          
          resolve({
            salesMapping,
            customerMapping,
            message,
            salesSheetName,
            customerSheetName,
            salesSheetExists,
            customerSheetExists
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

// 새로운 AI 출력 결과 파싱 함수
function parseNewMappingOutput(output) {
  const lines = output.split('\n');
  const salesMapping = {};
  const customerMapping = {};
  
  let currentSection = null;
  let inMappingSection = false;
  
  for (const line of lines) {
    // 섹션 구분
    if (line.includes('제품 판매 기록 시트 매핑 결과:')) {
      currentSection = 'sales';
      inMappingSection = true;
      continue;
    } else if (line.includes('고객 정보 시트 매핑 결과:')) {
      currentSection = 'customer';
      inMappingSection = true;
      continue;
    } else if (line.includes('최종 매핑 요약')) {
      inMappingSection = false;
      break;
    }
    
    // 매핑 결과 파싱
    if (inMappingSection && line.includes('→')) {
      const parts = line.split('→');
      if (parts.length === 2) {
        const originalField = parts[0].trim();
        const restPart = parts[1].trim();
        
        // "없음" 처리
        if (restPart.includes('없음')) {
          if (currentSection === 'sales') {
            salesMapping[originalField] = null;
          } else if (currentSection === 'customer') {
            customerMapping[originalField] = null;
          }
        } else {
          // 정상 매핑 처리
          const fieldMatch = restPart.match(/^([^\(]+)/);
          if (fieldMatch) {
            const mappedField = fieldMatch[1].trim();
            if (currentSection === 'sales') {
              salesMapping[originalField] = mappedField;
            } else if (currentSection === 'customer') {
              customerMapping[originalField] = mappedField;
            }
          }
        }
      }
    }
  }
  
  return { salesMapping, customerMapping };
}

// 제품 판매 기록 시트 데이터 생성
function createSalesSheetData(originalHeaders, originalRows, salesMapping) {
  // 제품 판매 기록 시트 헤더 정의
  const salesHeaders = [
    '주문_번호', '주문자명', '주문_일자', '거래_완료_일자', 
    '상품명', '단가', '총_주문_금액', '주문_상태'
  ];
  
  // 매핑 인덱스 생성
  const mappingIndices = {};
  salesHeaders.forEach(targetField => {
    for (const [originalField, mappedField] of Object.entries(salesMapping)) {
      if (mappedField === targetField) {
        const index = originalHeaders.indexOf(originalField);
        if (index !== -1) {
          mappingIndices[targetField] = index;
        }
        break;
      }
    }
  });
  
  // 데이터 변환
  const salesData = [salesHeaders];
  
  originalRows.forEach(row => {
    const newRow = salesHeaders.map(targetField => {
      const index = mappingIndices[targetField];
      return index !== undefined ? (row[index] || '') : '';
    });
    
    // 예외 처리: 거래_완료_일자가 없으면 주문_일자 + 3일
    if (!mappingIndices['거래_완료_일자'] && mappingIndices['주문_일자']) {
      const orderDateIndex = salesHeaders.indexOf('주문_일자');
      const completionDateIndex = salesHeaders.indexOf('거래_완료_일자');
      const orderDate = newRow[orderDateIndex];
      
      if (orderDate) {
        try {
          const date = new Date(orderDate);
          date.setDate(date.getDate() + 3);
          newRow[completionDateIndex] = date.toISOString().split('T')[0];
        } catch (e) {
          newRow[completionDateIndex] = '';
        }
      }
    }
    
    // 예외 처리: 주문_상태가 없으면 '거래 완료'
    if (!mappingIndices['주문_상태']) {
      const statusIndex = salesHeaders.indexOf('주문_상태');
      newRow[statusIndex] = '거래 완료';
    }
    
    salesData.push(newRow);
  });
  
  return salesData;
}

// 고객 정보 시트 데이터 생성
function createCustomerSheetData(originalHeaders, originalRows, customerMapping) {
  // 고객 정보 시트 헤더 정의
  const customerHeaders = [
    '고객ID', '고객명', '연락처', '이메일', '가입일',
    '마지막_구매일', '총_구매_금액', '총_구매_횟수', '탄소_감축_등급', '탄소_감축_점수'
  ];
  
  // 매핑 인덱스 생성 (계산용 필드 제외)
  const mappingIndices = {};
  const basicFields = ['고객ID', '고객명', '연락처', '이메일', '가입일'];
  
  basicFields.forEach(targetField => {
    for (const [originalField, mappedField] of Object.entries(customerMapping)) {
      if (mappedField === targetField) {
        const index = originalHeaders.indexOf(originalField);
        if (index !== -1) {
          mappingIndices[targetField] = index;
        }
        break;
      }
    }
  });
  
  // 고객 데이터 중복 제거 및 변환
  const customerData = [customerHeaders];
  const seenCustomers = new Set();
  
  originalRows.forEach(row => {
    // 고객 식별자 생성 (고객ID 또는 고객명 기준)
    const customerIdIndex = mappingIndices['고객ID'];
    const customerNameIndex = mappingIndices['고객명'];
    const customerId = customerIdIndex !== undefined ? row[customerIdIndex] : '';
    const customerName = customerNameIndex !== undefined ? row[customerNameIndex] : '';
    
    const customerKey = customerId || customerName;
    
    if (customerKey && !seenCustomers.has(customerKey)) {
      seenCustomers.add(customerKey);
      
      const newRow = customerHeaders.map(targetField => {
        if (['마지막_구매일', '총_구매_금액', '총_구매_횟수', '탄소_감축_등급', '탄소_감축_점수'].includes(targetField)) {
          return ''; // 계산용 필드는 빈 값 (마지막_구매일, 총_구매_금액, 총_구매_횟수는 나중에 calculateCustomerPurchaseStats에서 계산됨)
        }
        
        const index = mappingIndices[targetField];
        return index !== undefined ? (row[index] || '') : '';
      });
      
      customerData.push(newRow);
    }
  });
  
  return customerData;
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

// 고객별 구매 통계 계산 함수
async function calculateCustomerPurchaseStats(sheets, spreadsheetId, salesSheetName, customerSheetName) {
  try {
    // 제품 판매 기록 시트 데이터 가져오기
    const salesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${salesSheetName}'!A:H`, // 제품 판매 기록 시트의 모든 컬럼
    });
    
    const salesData = salesResponse.data.values || [];
    if (salesData.length <= 1) {
      console.log('제품 판매 기록 데이터가 없어 통계 계산을 건너뜁니다.');
      return;
    }
    
    // 고객 정보 시트 데이터 가져오기
    const customerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${customerSheetName}'!A:J`, // 고객 정보 시트의 모든 컬럼
    });
    
    const customerData = customerResponse.data.values || [];
    if (customerData.length <= 1) {
      console.log('고객 정보 데이터가 없어 통계 계산을 건너뜁니다.');
      return;
    }
    
    // 헤더 분석
    const salesHeaders = salesData[0];
    const customerHeaders = customerData[0];
    
    // 필요한 컬럼 인덱스 찾기
    const salesIndices = {
      주문자명: salesHeaders.indexOf('주문자명'),
      총_주문_금액: salesHeaders.indexOf('총_주문_금액'),
      주문_일자: salesHeaders.indexOf('주문_일자')
    };
    
    const customerIndices = {
      고객명: customerHeaders.indexOf('고객명'),
      총_구매_금액: customerHeaders.indexOf('총_구매_금액'),
      총_구매_횟수: customerHeaders.indexOf('총_구매_횟수'),
      마지막_구매일: customerHeaders.indexOf('마지막_구매일')
    };
    
    console.log('Sales indices:', salesIndices);
    console.log('Customer indices:', customerIndices);
    
    // 고객별 구매 통계 계산
    const customerStats = {};
    
    // 제품 판매 기록을 순회하며 고객별 통계 집계
    for (let i = 1; i < salesData.length; i++) {
      const row = salesData[i];
      const customerName = row[salesIndices.주문자명] || '';
      const totalAmount = parseFloat(row[salesIndices.총_주문_금액] || 0);
      const orderDate = row[salesIndices.주문_일자] || '';
      
      if (!customerName) continue;
      
      if (!customerStats[customerName]) {
        customerStats[customerName] = {
          totalAmount: 0,
          totalCount: 0,
          lastPurchaseDate: ''
        };
      }
      
      customerStats[customerName].totalAmount += totalAmount;
      customerStats[customerName].totalCount += 1;
      
      // 마지막 구매일 업데이트 (더 최근 날짜로)
      if (orderDate && (!customerStats[customerName].lastPurchaseDate || 
          new Date(orderDate) > new Date(customerStats[customerName].lastPurchaseDate))) {
        customerStats[customerName].lastPurchaseDate = orderDate;
      }
    }
    
    console.log('계산된 고객 통계:', customerStats);
    
    // 고객 정보 시트 업데이트
    const updates = [];
    
    for (let i = 1; i < customerData.length; i++) {
      const row = customerData[i];
      const customerName = row[customerIndices.고객명] || '';
      
      if (customerName && customerStats[customerName]) {
        const stats = customerStats[customerName];
        
        // 업데이트할 셀 범위와 값 준비
        const rowNumber = i + 1; // Google Sheets는 1부터 시작
        
        // 총 구매 금액 업데이트
        if (customerIndices.총_구매_금액 !== -1) {
          updates.push({
            range: `'${customerSheetName}'!${getColumnLetter(customerIndices.총_구매_금액 + 1)}${rowNumber}`,
            values: [[stats.totalAmount]]
          });
        }
        
        // 총 구매 횟수 업데이트
        if (customerIndices.총_구매_횟수 !== -1) {
          updates.push({
            range: `'${customerSheetName}'!${getColumnLetter(customerIndices.총_구매_횟수 + 1)}${rowNumber}`,
            values: [[stats.totalCount]]
          });
        }
        
        // 마지막 구매일 업데이트
        if (customerIndices.마지막_구매일 !== -1 && stats.lastPurchaseDate) {
          updates.push({
            range: `'${customerSheetName}'!${getColumnLetter(customerIndices.마지막_구매일 + 1)}${rowNumber}`,
            values: [[stats.lastPurchaseDate]]
          });
        }
      }
    }
    
    // 배치 업데이트 실행
    if (updates.length > 0) {
      console.log(`${updates.length}개의 셀을 업데이트합니다.`);
      
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: 'RAW',
          data: updates
        }
      });
      
      console.log('고객 구매 통계 업데이트 완료');
    } else {
      console.log('업데이트할 데이터가 없습니다.');
    }
    
  } catch (error) {
    console.error('고객 구매 통계 계산 중 오류:', error);
    throw error;
  }
}

// 컬럼 번호를 Excel 스타일 문자로 변환하는 헬퍼 함수
function getColumnLetter(columnNumber) {
  let result = '';
  while (columnNumber > 0) {
    columnNumber--;
    result = String.fromCharCode(65 + (columnNumber % 26)) + result;
    columnNumber = Math.floor(columnNumber / 26);
  }
  return result;
}

// 고객별 탄소 감축 점수 및 등급 계산 함수
async function calculateCarbonReductionStats(sheets, spreadsheetId, salesSheetName, customerSheetName) {
  console.log('탄소 감축 점수 및 등급 계산 시작...');
  
  try {
    // 탄소 배출량 데이터 로드
    const carbonDataPath = path.join(__dirname, '../../data/생활용품 탄소배출량.csv');
    const categoryDataPath = path.join(__dirname, '../../data/카테고리 별 기준 제품.csv');
    
    if (!fs.existsSync(carbonDataPath) || !fs.existsSync(categoryDataPath)) {
      console.log('탄소 배출량 데이터 파일을 찾을 수 없습니다.');
      return;
    }
    
    // CSV 파일 읽기
    const carbonData = fs.readFileSync(carbonDataPath, 'utf8');
    const categoryData = fs.readFileSync(categoryDataPath, 'utf8');
    
    // CSV 파싱
    const carbonLines = carbonData.split('\n').slice(1); // 헤더 제외
    const categoryLines = categoryData.split('\n').slice(1); // 헤더 제외
    
    // 제품별 탄소 배출량 맵 생성
    const productCarbonMap = {};
    carbonLines.forEach(line => {
      if (line.trim()) {
        const [industry, code, productName, emissionFactor, weightFactor, totalEmission, category, isBaseProduct] = line.split(',');
        if (productName && totalEmission) {
          productCarbonMap[productName.trim()] = {
            totalEmission: parseFloat(totalEmission.trim()),
            category: category.trim()
          };
        }
      }
    });
    
    // 카테고리별 기준 제품 탄소 배출량 맵 생성
    const categoryBaseMap = {};
    categoryLines.forEach(line => {
      if (line.trim()) {
        const [category, baseProductName, productCode, baseEmission] = line.split(',');
        if (category && baseEmission) {
          categoryBaseMap[category.trim()] = parseFloat(baseEmission.trim());
        }
      }
    });
    
    // 판매 데이터 가져오기
    const salesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${salesSheetName}'!A:H`, // A부터 H열까지 (주문 상태까지)
    });
    
    const salesRows = salesResponse.data.values || [];
    if (salesRows.length < 2) {
      console.log('판매 데이터가 충분하지 않습니다.');
      return;
    }
    
    // 고객 데이터 가져오기
    const customerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${customerSheetName}'!A:J`, // A부터 J열까지 (탄소 감축 점수까지)
    });
    
    const customerRows = customerResponse.data.values || [];
    if (customerRows.length < 2) {
      console.log('고객 데이터가 충분하지 않습니다.');
      return;
    }
    
    // 헤더 확인
    const salesHeaders = salesRows[0];
    const customerHeaders = customerRows[0];
    
    console.log('Sales headers:', salesHeaders);
    console.log('Customer headers:', customerHeaders);
    
    // 필요한 컬럼 인덱스 찾기
    const orderNameIdx = salesHeaders.findIndex(h => h === '주문자명');
    const productNameIdx = salesHeaders.findIndex(h => h === '상품명');
    const unitPriceIdx = salesHeaders.findIndex(h => h === '단가');
    const quantityIdx = salesHeaders.findIndex(h => h === '수량');
    const totalAmountIdx = salesHeaders.findIndex(h => h === '총_주문_금액');
    const customerNameIdx = customerHeaders.findIndex(h => h === '고객명');
    const carbonScoreIdx = customerHeaders.findIndex(h => h === '탄소_감축_점수');
    const carbonGradeIdx = customerHeaders.findIndex(h => h === '탄소_감축_등급');
    
    console.log('Found indices:', {
      orderNameIdx, productNameIdx, unitPriceIdx, quantityIdx, totalAmountIdx,
      customerNameIdx, carbonScoreIdx, carbonGradeIdx
    });
    
    if (orderNameIdx === -1 || productNameIdx === -1 || totalAmountIdx === -1 || customerNameIdx === -1 || carbonScoreIdx === -1 || carbonGradeIdx === -1) {
      console.log('필요한 컬럼을 찾을 수 없습니다.');
      return;
    }
    
    // 고객별 탄소 감축 점수 계산
    const customerCarbonStats = {};
    
    // 판매 데이터를 순회하며 고객별 구매 정보 수집
    for (let i = 1; i < salesRows.length; i++) {
      const row = salesRows[i];
      if (row.length === 0) continue;
      
      const customerName = row[orderNameIdx]?.toString().trim();
      const productName = row[productNameIdx]?.toString().trim();
      const unitPrice = parseFloat(row[unitPriceIdx]?.toString().replace(/[^0-9.-]/g, '') || '0');
      const totalAmount = parseFloat(row[totalAmountIdx]?.toString().replace(/[^0-9.-]/g, '') || '0');
      
      // 수량 필드가 있으면 사용, 없으면 계산
      let quantity = 1;
      if (quantityIdx !== -1 && row[quantityIdx]) {
        quantity = parseInt(row[quantityIdx]?.toString().replace(/[^0-9]/g, '') || '1');
      } else if (unitPrice > 0) {
        quantity = Math.round(totalAmount / unitPrice);
      }
      
      if (!customerName || !productName || totalAmount <= 0 || quantity <= 0) continue;
      
      // 제품의 탄소 배출량 정보 찾기
      let productInfo = productCarbonMap[productName];
      if (!productInfo) {
        // 정확한 매칭이 안 되면 유사한 제품명 찾기
        let bestMatch = null;
        
        for (const [mapProductName, info] of Object.entries(productCarbonMap)) {
          if (productName.includes(mapProductName.replace(/\s/g, '')) || 
              mapProductName.includes(productName.replace(/\s/g, ''))) {
            bestMatch = info;
            console.log(`제품 "${productName}"을 "${mapProductName}"으로 매칭했습니다.`);
            break;
          }
        }
        
        if (!bestMatch) {
          console.log(`제품 "${productName}"의 탄소 배출량 정보를 찾을 수 없습니다.`);
          continue;
        }
        productInfo = bestMatch;
      }
      
      // 카테고리의 기준 제품 탄소 배출량 찾기
      const baseEmission = categoryBaseMap[productInfo.category];
      if (baseEmission === undefined) {
        console.log(`카테고리 "${productInfo.category}"의 기준 제품 탄소 배출량을 찾을 수 없습니다.`);
        continue;
      }
      
      // 탄소 감축 점수 계산 (기준 배출량 - 제품 배출량)
      const carbonReduction = baseEmission - productInfo.totalEmission;
      const totalCarbonReduction = carbonReduction * quantity;
      
      if (!customerCarbonStats[customerName]) {
        customerCarbonStats[customerName] = 0;
      }
      
      customerCarbonStats[customerName] += totalCarbonReduction;
      
      console.log(`${customerName}: ${productName} ${quantity}개 구매, 단위 탄소 감축: ${carbonReduction.toFixed(2)}, 총 탄소 감축: ${totalCarbonReduction.toFixed(2)}`);
    }
    
    // 탄소 감축 등급 계산 함수
    function getCarbonGrade(score) {
      if (score <= 0) return 'Stone';
      if (score < 200) return 'Bronze';
      if (score < 500) return 'Silver';
      if (score < 1000) return 'Gold';
      if (score < 3000) return 'Platinum';
      return 'Diamond';
    }
    
    // 고객 시트 업데이트 준비
    const updateRequests = [];
    
    for (let i = 1; i < customerRows.length; i++) {
      const row = customerRows[i];
      if (row.length === 0) continue;
      
      const customerName = row[customerNameIdx]?.toString().trim();
      if (!customerName) continue;
      
      const carbonScore = customerCarbonStats[customerName] || 0;
      const carbonGrade = getCarbonGrade(carbonScore);
      
      // 탄소 감축 점수 업데이트
      updateRequests.push({
        range: `'${customerSheetName}'!${getColumnLetter(carbonScoreIdx + 1)}${i + 1}`,
        values: [[Math.round(carbonScore * 100) / 100]] // 소수점 둘째 자리까지
      });
      
      // 탄소 감축 등급 업데이트
      updateRequests.push({
        range: `'${customerSheetName}'!${getColumnLetter(carbonGradeIdx + 1)}${i + 1}`,
        values: [[carbonGrade]]
      });
    }
    
    // 배치 업데이트 실행
    if (updateRequests.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: updateRequests
        }
      });
      
      console.log(`${updateRequests.length / 2}명의 고객 탄소 감축 데이터가 업데이트되었습니다.`);
    }
    
  } catch (error) {
    console.error('탄소 감축 점수 계산 중 오류 발생:', error);
  }
}

module.exports = router; 