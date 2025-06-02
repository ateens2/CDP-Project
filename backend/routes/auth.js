// src/routes/auth.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mysql = require('mysql2/promise');
const { recordCustomerChangeHistory } = require('../utils/changeHistory');

// MySQL 연결 설정 (namedPlaceholders 옵션 사용)
const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_NAME,
  namedPlaceholders: true,
};

// Passport serialize/deserialize 설정 (오직 email, displayName, accessToken만 저장)
passport.serializeUser((user, done) => {
  // user 객체는 GoogleStrategy에서 DB 조회 후 전달된 profile 객체일 수도 있고,
  // DB에서 직접 조회한 사용자 정보일 수도 있습니다.
  // role 정보는 DB에서 가져와야 합니다.
  const userToSerialize = {
    email: user.emails ? user.emails[0].value : user.email, // Google profile 또는 DB user
    displayName: user.displayName,
    accessToken: user.accessToken, // Google 로그인 시에만 존재
    role: user.role // DB에서 조회된 role 또는 Google profile에 없는 경우 기본값 설정 필요
  };
  done(null, userToSerialize);
});

passport.deserializeUser(async (serializedUser, done) => {
  // 세션에 저장된 사용자 정보로 매 요청 시 DB에서 최신 사용자 정보를 가져올 수 있습니다.
  // 여기서는 세션에 저장된 role을 그대로 사용하거나, 필요시 DB에서 다시 조회합니다.
  // 간단하게 하기 위해 세션의 role을 신뢰합니다.
  if (serializedUser && serializedUser.email) {
    // 필요하다면 여기서 DB를 조회하여 사용자의 최신 role 정보를 가져와서 obj에 추가할 수 있습니다.
    // 예: const dbUser = await findUserByEmail(serializedUser.email); serializedUser.role = dbUser.role;
    done(null, serializedUser); 
  } else {
    done(new Error('User not found in session'), null);
  }
});

// Google OAuth 전략 설정
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    console.log("\n[AUTH_DEBUG] GoogleStrategy callback_BEGIN");
    console.log("[AUTH_DEBUG] Received accessToken:", accessToken);
    console.log("[AUTH_DEBUG] Received refreshToken:", refreshToken);
    console.log("[AUTH_DEBUG] Received profile:", JSON.stringify(profile, null, 2));
    let connection;
    try {
      connection = await mysql.createConnection(mysqlConfig);
      const googleEmail = profile.emails[0].value;
      const [rows] = await connection.execute(
        "SELECT email, name, phone, sheet_file, role FROM customer WHERE LOWER(email) = LOWER(?)",
        [googleEmail]
      );
      
      let userInDb;
      if (rows.length > 0) {
        userInDb = rows[0];
      } else {
        // 사용자가 DB에 없으면, 기본 role('user')로 간주하거나, 별도 처리
        // 여기서는 DB에 없으면 로그인만 시키고, /auth/me 등에서 상세 정보를 가져오므로
        // profile 객체에 role이 없어도 serializeUser에서 처리됩니다.
        // 다만, 명시적으로 role을 추가하려면 여기서 default role을 설정할 수 있습니다.
        // userInDb = { email: googleEmail, displayName: profile.displayName, role: 'user' }; 
      }
      
      // profile 객체에 accessToken과 DB에서 가져온 role (있다면) 추가
      const userForSession = {
        ...profile, // Google 프로필 정보
        email: googleEmail, // 명시적으로 이메일 설정
        displayName: profile.displayName,
        accessToken: accessToken,
        role: userInDb ? userInDb.role : 'user' // DB에 있으면 해당 role, 없으면 'user'
      };
      
      return done(null, userForSession);
    } catch (err) {
      console.error("[AUTH_DEBUG] MySQL error or other error in GoogleStrategy:", err);
      return done(err, null);
    } finally {
      if (connection) await connection.end();
      console.log("[AUTH_DEBUG] GoogleStrategy callback_END\n");
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
           created_at,
           level,
           experience,
           experience_to_next_level as experienceToNextLevel,
           role
         FROM customer
         WHERE LOWER(email) = LOWER(?)`,
        [userEmail]
      );
      await connection.end();
      if (rows.length > 0) {
        const dbUser = rows[0];
        // 세션에 저장된 accessToken 추가 (deserializeUser에서 이미 role이 들어갔으므로 여기서 다시 덮어쓸 필요 없음)
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

// 9. 사용자 정보 수정 (이름, 전화번호, 시트 파일)
router.patch('/updateUser', async (req, res) => {
  if (!req.isAuthenticated()) 
    return res.status(401).json({ message: 'Unauthorized' });

  const updates = req.body;      
  const userEmail = req.user.email; // 현재 로그인한 사용자의 이메일
  const changedBy = req.user.email; // 변경을 수행한 사용자 (로그인한 사용자 본인)

  console.log(`[/updateUser] Request to update user: ${userEmail}, Updates: ${JSON.stringify(updates)}`);

  // 1. 기존 데이터 조회
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig);
    const [rows] = await connection.execute(
      "SELECT * FROM customer WHERE LOWER(email) = LOWER(?)",
      [userEmail]
    );
    if (rows.length === 0) {
      await connection.end();
      return res.status(404).json({ message: 'User not found' });
    }
    const before = rows[0];
    console.log(`[/updateUser] Data before update for ${userEmail}: ${JSON.stringify(before)}`);

    // 2. 업데이트 실행
    const fields = Object.keys(updates);
    if (fields.length === 0) {
      console.log('[/updateUser] No fields to update.');
      await connection.end(); // 여기서 연결을 닫아야 함
      return res.status(400).json({ message: '변경할 필드가 없습니다.' });
    }

    const setClauses = [];
    const params = [];
    fields.forEach((key) => {
      // role 필드는 이 API를 통해 직접 수정하지 못하도록 방어할 수 있습니다.
      if (key === 'role') return; 
      setClauses.push(`${key} = ?`);
      params.push(updates[key]);
    });
    
    if (setClauses.length === 0) { // role만 업데이트하려고 한 경우
        console.log('[/updateUser] Only role field was sent, no actual update performed on customer table directly by this route.');
        await connection.end();
        // 필요하다면 여기서 recordCustomerChangeHistory를 호출할 수도 있으나, 현재 로직상 role은 다른 방식으로 관리
        return res.json({ message: 'No updatable fields provided for customer table.' });
    }
    
    params.push(userEmail); // WHERE 절의 email

    const sql = `
      UPDATE customer
         SET ${setClauses.join(', ')}
       WHERE LOWER(email) = LOWER(?)
    `;
    console.log(`[/updateUser] Executing SQL: ${sql} with params: ${JSON.stringify(params)}`);
    await connection.execute(sql, params);

    // 3. 변경 후 데이터 조회
    const [afterRows] = await connection.execute(
      "SELECT * FROM customer WHERE LOWER(email) = LOWER(?)",
      [userEmail]
    );
    const after = afterRows[0];
    console.log(`[/updateUser] Data after update for ${userEmail}: ${JSON.stringify(after)}`);

    await connection.end();
    res.json({ message: '사용자 정보 수정완료' });
  } catch (err) {
    if (connection) await connection.end();
    console.error('[/updateUser] Error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

// End of auth routes
