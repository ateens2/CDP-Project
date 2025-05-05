// src/routes/auth.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mysql = require('mysql2/promise');

// MySQL 연결 설정 (namedPlaceholders 옵션 사용)
const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  namedPlaceholders: true,
};

// Passport serialize/deserialize 설정 (오직 email, displayName, accessToken만 저장)
passport.serializeUser((user, done) => {
  const minimalUser = {
    email: user.emails ? user.emails[0].value : null,
    displayName: user.displayName,
    accessToken: user.accessToken, // accessToken 포함
  };
  done(null, minimalUser);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Google OAuth 전략 설정 – 추가 스코프 포함
// ※ 사용자가 DB에 없으면 자동 INSERT하지 않고, 단순히 프로파일에 accessToken을 첨부한 후 반환합니다.
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    let connection;
    try {
      connection = await mysql.createConnection(mysqlConfig);
      // 오직 email만으로 사용자 존재 여부 조회 (자동 INSERT 제거)
      const [rows] = await connection.execute(
        "SELECT * FROM customer WHERE LOWER(email) = LOWER(?)",
        [profile.emails[0].value]
      );
      await connection.end();
      // 사용자 존재 여부와 상관없이, 프로파일에 accessToken을 첨부해서 반환합니다.
      profile.accessToken = accessToken;
      return done(null, profile);
    } catch (err) {
      if (connection) await connection.end();
      console.error("MySQL error:", err);
      return done(err, null);
    }
  }
));

// 1. Google 로그인 라우트: 필요한 스코프 포함
router.get('/google',
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  })
);

// 2. Google OAuth 콜백 라우트: 인증 완료 후 프론트엔드로 리디렉션  
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: 'http://localhost:5173/login' }),
  (req, res) => {
    // 인증 후 프론트엔드로 이동시키되, DB에 등록되어 있는지 클라이언트에서 확인할 수 있게 합니다.
    res.redirect('http://localhost:5173');
  }
);

// 3. 백엔드 API: 이메일을 기준으로 가입 여부 확인  
//    (DB에 해당 이메일의 사용자가 없으면 exists: false 반환)
router.post('/google/check', async (req, res) => {
  const { email } = req.body;
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig);
    const [rows] = await connection.execute(
      "SELECT email, name, phone, sheet_file FROM customer WHERE LOWER(email) = LOWER(:email)",
      { email }
    );
    await connection.end();
    if (rows.length > 0) {
      res.json({ exists: true, user: rows[0], sheets: [] });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    if (connection) await connection.end();
    console.error("Error checking user:", err);
    res.status(500).json({ message: err.message });
  }
});

// 4. 백엔드 API: 신규 가입 요청 처리 (Signup 페이지에서 호출)
//    사용자가 없을 때, 추가 정보를 입력 받아 DB에 INSERT
router.post('/google/signup', async (req, res) => {
  const { name, email, phone } = req.body;
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig);
    await connection.execute(
      "INSERT INTO customer (email, name, phone, sheet_file) VALUES (?, ?, ?, ?)",
      [email, name, phone, null]
    );
    await connection.end();
    res.json({ user: { name, email, phone } });
  } catch (err) {
    if (connection) await connection.end();
    console.error("Error signing up user:", err);
    res.status(500).json({ message: err.message });
  }
});

// 5. 백엔드 API: 시트 파일 업데이트  
router.post('/google/updateSheet', async (req, res) => {
  const { email, sheet_file } = req.body;
  console.log("UpdateSheet request:", email, sheet_file);
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig);
    const [result] = await connection.execute(
      "UPDATE customer SET sheet_file = :sheet_file WHERE LOWER(email) = LOWER(:email)",
      { sheet_file, email }
    );
    console.log("Rows affected:", result.affectedRows);
    await connection.end();
    res.json({ message: 'Sheet info updated successfully.', rowsAffected: result.affectedRows });
  } catch (err) {
    if (connection) await connection.end();
    console.error("Error updating sheet info:", err);
    res.status(500).json({ message: err.message });
  }
});

// 6. 현재 로그인한 사용자 정보 반환 (/auth/me)
//    세션 기반이며, DB에서 사용자 정보를 조회한 후, 세션에 저장된 accessToken을 추가하여 반환
router.get('/me', async (req, res) => {
  console.log("GET /auth/me 요청 도착");
  console.log("User info from session:", req.user);
  if (req.isAuthenticated()) {
    const userEmail = req.user.email;
    let connection;
    try {
      connection = await mysql.createConnection(mysqlConfig);
      console.log("MySQL 연결 성공");
      const [rows] = await connection.execute(
        `SELECT
           email,
           name,
           phone,
           sheet_file,
           created_,
           level,
           experience,
           experience_to_next_level as experienceToNextLevel
         FROM customer
         WHERE LOWER(email) = LOWER(?)`,
        [userEmail]
      );
      await connection.end();
      if (rows.length > 0) {
        const dbUser = rows[0];
        // 세션에 저장된 accessToken 추가
        dbUser.accessToken = req.user.accessToken;
        res.json({ user: dbUser });
      } else {
        // DB에 레코드가 없을 때
        res.status(404).json({
          user: null,
          googleEmail: req.user.email,
          message: "User not found"
        });
      }
    } catch (err) {
      if (connection) await connection.end();
      console.error("Error in /auth/me:", err);
      res.status(500).json({ message: err.message });
    }
  } else {
    res.status(401).json({ user: null });
  }
});


// 7. 로그아웃 엔드포인트
router.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) {
      console.error("Logout error:", err);
      return next(err);
    }
    req.session.destroy(function(err) {
      if (err) console.error("Session destroy error:", err);
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });
});

module.exports = router;

// 유저 정보 업데이트 (/auth/updateUser)
router.patch('/updateUser', async (req, res) => {
  if (!req.isAuthenticated()) 
    return res.status(401).json({ message: 'Unauthorized' });

  const updates = req.body;        // { name?: "...", phone?: "...", sheet_file?: "..." }
  const userEmail = req.user.email;

  // 수정할 필드가 없으면 에러
  const fields = Object.keys(updates);
  if (fields.length === 0) 
    return res.status(400).json({ message: '변경할 필드가 없습니다.' });

  // 동적으로 SET 절 생성
  const setClauses = [];
  const params = [];
  fields.forEach((key) => {
    setClauses.push(`${key} = ?`);
    params.push(updates[key]);
  });
  params.push(userEmail);

  const sql = `
    UPDATE customer
       SET ${setClauses.join(', ')}
     WHERE LOWER(email) = LOWER(?)
  `;

  let conn;
  try {
    conn = await mysql.createConnection(mysqlConfig);
    const [result] = await conn.execute(sql, params);
    await conn.end();
    res.json({ message: '사용자 정보 수정완료', affectedRows: result.affectedRows });
  } catch (err) {
    if (conn) await conn.end();
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


// End of auth routes
