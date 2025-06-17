// src/routes/auth.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// SQLite 연결 설정
const dbPath = path.join(__dirname, '../dummy.db');
const db = new sqlite3.Database(dbPath);

// 더미 사용자 정보
const DUMMY_USER = {
  email: 'dummy@example.com',
  name: '홍길동',
  phone: '010-1234-5678',
  sheet_file: 'GRM 더미 데이터.xlsx',
  level: 1,
  experience: 0,
  experienceToNextLevel: 100,
  role: 'admin',
  created_at: '2025-06-11 15:15:02',
  updated_at: '2025-06-11 15:15:02'
};

// 1. Google 로그인 라우트 (더미 로그인으로 변경)
router.get('/google', (req, res) => {
  // 세션에 더미 사용자 정보 저장
  req.session.user = DUMMY_USER;
  
  // 프론트엔드로 리디렉션
  res.redirect('http://localhost:5173');
});

// 2. Google OAuth 콜백 라우트 (더미 처리)
router.get('/google/callback', (req, res) => {
  req.session.user = DUMMY_USER;
  res.redirect('http://localhost:5173');
});

// 3. 백엔드 API: 이메일을 기준으로 가입 여부 확인  
router.post('/google/check', (req, res) => {
  const { email } = req.body;
  
  db.get(
    "SELECT email, name, phone, sheet_file FROM users WHERE LOWER(email) = LOWER(?)",
    [email],
    (err, row) => {
      if (err) {
        console.error("Error checking user:", err);
        return res.status(500).json({ message: err.message });
      }
      
      if (row) {
        res.json({ exists: true, user: row, sheets: [] });
      } else {
        res.json({ exists: false });
      }
    }
  );
});

// 4. 백엔드 API: 신규 가입 요청 처리
router.post('/google/signup', (req, res) => {
  const { name, email, phone } = req.body;
  
  db.run(
    "INSERT INTO users (email, name, phone, sheet_file) VALUES (?, ?, ?, ?)",
    [email, name, phone, null],
    function(err) {
      if (err) {
        console.error("Error signing up user:", err);
        return res.status(500).json({ message: err.message });
      }
      res.json({ user: { name, email, phone } });
    }
  );
});

// 5. 백엔드 API: 시트 파일 업데이트  
router.post('/google/updateSheet', (req, res) => {
  const { email, sheet_file } = req.body;
  console.log("UpdateSheet request:", email, sheet_file);
  
  db.run(
    "UPDATE users SET sheet_file = ? WHERE LOWER(email) = LOWER(?)",
    [sheet_file, email],
    function(err) {
      if (err) {
        console.error("Error updating sheet info:", err);
        return res.status(500).json({ message: err.message });
      }
      console.log("Rows affected:", this.changes);
      res.json({ message: 'Sheet info updated successfully.', rowsAffected: this.changes });
    }
  );
});

// 6. 현재 로그인한 사용자 정보 반환 (/auth/me)
router.get('/me', (req, res) => {
  console.log("GET /auth/me 요청 도착");
  
  // 세션에 사용자 정보가 있으면 반환, 없으면 더미 사용자 정보 반환
  if (req.session.user) {
    console.log("세션에서 사용자 정보 찾음:", req.session.user);
    res.json({ user: req.session.user });
  } else {
    // 더미 사용자로 자동 로그인 처리
    console.log("세션에 사용자 정보 없음, 더미 사용자로 자동 로그인");
    req.session.user = DUMMY_USER;
    res.json({ user: DUMMY_USER });
  }
});

// 7. 로그아웃 엔드포인트
router.get('/logout', (req, res) => {
  req.session.destroy(function(err) {
    if (err) {
      console.error("Session destroy error:", err);
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// 8. 사용자 정보 수정
router.patch('/updateUser', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const updates = req.body;      
  const userEmail = req.session.user.email;

  console.log(`[/updateUser] Request to update user: ${userEmail}, Updates: ${JSON.stringify(updates)}`);

  // 업데이트할 필드가 있는지 확인
  const fields = Object.keys(updates);
  if (fields.length === 0) {
    console.log('[/updateUser] No fields to update.');
    return res.status(400).json({ message: '변경할 필드가 없습니다.' });
  }

  // SQL 쿼리 생성
  const setClauses = [];
  const params = [];
  fields.forEach((key) => {
    if (key === 'role') return; // role은 직접 수정 불가
    setClauses.push(`${key} = ?`);
    params.push(updates[key]);
  });
  
  if (setClauses.length === 0) {
    console.log('[/updateUser] Only role field was sent, no actual update performed.');
    return res.json({ message: 'No updatable fields provided.' });
  }
  
  params.push(userEmail); // WHERE 절의 email

  const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE LOWER(email) = LOWER(?)`;
  console.log(`[/updateUser] Executing SQL: ${sql} with params: ${JSON.stringify(params)}`);
  
  db.run(sql, params, function(err) {
    if (err) {
      console.error('[/updateUser] Error:', err);
      return res.status(500).json({ message: err.message });
    }
    
    // 세션의 사용자 정보도 업데이트
    Object.keys(updates).forEach(key => {
      if (key !== 'role') {
        req.session.user[key] = updates[key];
      }
    });
    
    res.json({ message: '사용자 정보 수정완료' });
  });
});

module.exports = router;

// End of auth routes
