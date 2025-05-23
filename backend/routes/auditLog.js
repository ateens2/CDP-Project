const express = require('express');
const router = express.Router();
// MySQL 관련 모듈 제거
const { google } = require('googleapis'); // googleapis 추가
require('dotenv').config();
const { isAdmin } = require('../middleware/authMiddleware');
// pool 모듈 import 제거

const CHANGE_HISTORY_SHEET_NAME = 'ChangeHistory'; // 시트 이름을 상수로 정의
const CHANGE_HISTORY_HEADERS = ['Timestamp', 'UserEmail', 'UniqueID', 'FieldName', 'OldValue', 'NewValue'];

// ChangeHistory 시트 존재 확인 및 생성 함수
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
      return true;
    }
    return true;
  } catch (error) {
    console.error(`시트 생성 중 오류 발생:`, error);
    throw error;
  }
}

// GET /api/auditlog/sheet/:spreadsheetId - 특정 스프레드시트의 변경 이력 조회 (관리자 전용)
router.get('/sheet/:spreadsheetId', isAdmin, async (req, res) => {
  const { spreadsheetId } = req.params;
  const { userEmail, UniqueID } = req.query; // 필터링 옵션

  if (!req.isAuthenticated()) { // 인증된 사용자인지 먼저 확인
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!spreadsheetId) {
    return res.status(400).json({ message: 'Spreadsheet ID is required.' });
  }

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: req.user.accessToken });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // 시트가 없으면 생성
    await ensureChangeHistorySheetExists(sheets, spreadsheetId);

    // ChangeHistory 시트 전체 데이터 가져오기 (작은따옴표로 시트명 감싸기)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${CHANGE_HISTORY_SHEET_NAME}'!A:F`, // 작은따옴표로 시트명 감싸기
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) { // 헤더만 있거나 데이터가 없는 경우
      return res.json({ auditLog: [] });
    }

    const headers = rows[0];
    let auditLogData = rows.slice(1).map(row => {
      let entry = {};
      headers.forEach((header, index) => {
        entry[header] = row[index];
      });
      return entry;
    });

    // 필터링 적용
    if (userEmail) {
      auditLogData = auditLogData.filter(entry => entry.UserEmail && entry.UserEmail.toLowerCase().includes(userEmail.toLowerCase()));
    }
    if (UniqueID) {
      // UniqueID는 보통 정확히 일치하는 것을 찾으므로 includes 대신 === 사용 고려
      auditLogData = auditLogData.filter(entry => entry.UniqueID === UniqueID);
    }
    
    // 최신순 정렬 (Timestamp 기준)
    auditLogData.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

    res.json({ auditLog: auditLogData });

  } catch (error) {
    console.error("Error fetching sheet audit log:", error);
    const apiError =
      error.errors && error.errors[0] && error.errors[0].message
        ? error.errors[0].message
        : error.message;
    const statusCode = error.code && Number.isInteger(error.code) ? error.code : 500;
    res.status(statusCode || 500).json({ message: 'Failed to fetch audit log from sheet.', error: apiError });
  }
});

/* // 기존 MySQL 기반 라우트 주석 처리 - 사용하지 않음
// 이 부분 전체를 주석 처리하거나 제거해도 됩니다.
*/

module.exports = router; 