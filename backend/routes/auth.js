// src/routes/auth.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const oracledb = require('oracledb');

const oracleConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECTION_STRING,
};

// Passport serialize/deserialize 설정
passport.serializeUser((user, done) => {
  const minimalUser = {
    id: user.id,
    email: user.emails ? user.emails[0].value : null,
    displayName: user.displayName,
    accessToken: user.accessToken, // accessToken 포함
  };
  done(null, minimalUser);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Google OAuth 전략 설정 – 추가 스코프 요청
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const connection = await oracledb.getConnection(oracleConfig);
      const result = await connection.execute(
        `SELECT * FROM users WHERE google_id = :googleId OR email = :email`,
        { googleId: profile.id, email: profile.emails[0].value },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (result.rows.length === 0) {
        await connection.execute(
          `INSERT INTO users (google_id, email, name, phone, sheet_file)
           VALUES (:googleId, :email, :name, :phone, :sheet_file)`,
          {
            googleId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            phone: null,
            sheet_file: null,
          },
          { autoCommit: true }
        );
      }
      await connection.close();
      // 토큰을 프로파일에 첨부
      profile.accessToken = accessToken;
      return done(null, profile);
    } catch (err) {
      console.error("Oracle DB error:", err);
      return done(err, null);
    }
  }
));

// 1. Google 로그인 라우트: 추가 스코프 포함
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
    res.redirect('http://localhost:5173');
  }
);

// (나머지 엔드포인트들은 이전과 동일)
router.post('/google/check', async (req, res) => {
  const { email } = req.body;
  try {
    const connection = await oracledb.getConnection(oracleConfig);
    const result = await connection.execute(
      `SELECT google_id AS google_id, email AS email, name AS name, phone AS phone, sheet_file AS sheet_file
       FROM users WHERE LOWER(email) = LOWER(:email)`,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    await connection.close();
    if (result.rows.length > 0) {
      const userData = result.rows[0];
      const normalizedUser = {};
      Object.keys(userData).forEach(key => {
        normalizedUser[key.toLowerCase()] = userData[key];
      });
      res.json({ exists: true, user: normalizedUser, sheets: [] });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    console.error("Error checking user:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/google/signup', async (req, res) => {
  const { name, email, phone } = req.body;
  try {
    const connection = await oracledb.getConnection(oracleConfig);
    await connection.execute(
      `INSERT INTO users (google_id, email, name, phone, sheet_file)
       VALUES (:googleId, :email, :name, :phone, :sheet_file)`,
      {
        googleId: null,
        email,
        name,
        phone,
        sheet_file: null,
      },
      { autoCommit: true }
    );
    await connection.close();
    res.json({ user: { name, email, phone } });
  } catch (err) {
    console.error("Error signing up user:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/google/updateSheet', async (req, res) => {
  const { email, sheet_file } = req.body;
  console.log(email, sheet_file);
  try {
    const connection = await oracledb.getConnection(oracleConfig);
    const result = await connection.execute(
      `UPDATE users SET sheet_file = :sheet_file WHERE LOWER(email) = LOWER(:email)`,
      { sheet_file, email },
      { autoCommit: true }
    );
    console.log("Rows affected:", result.rowsAffected);
    await connection.close();
    res.json({ message: 'Sheet info updated successfully.', rowsAffected: result.rowsAffected });
  } catch (err) {
    console.error("Error updating sheet info:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', async (req, res) => {
  console.log("Session info:", req.session);
  console.log("User info from session:", req.user);
  if (req.isAuthenticated()) {
    const userEmail = req.user.email;
    try {
      const connection = await oracledb.getConnection(oracleConfig);
      const result = await connection.execute(
        `SELECT google_id, email, name, phone, sheet_file 
         FROM users 
         WHERE LOWER(email) = LOWER(:email)`,
        { email: userEmail },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      await connection.close();
      
      if (result.rows.length > 0) {
        const dbUser = result.rows[0];
        const normalizedUser = {};
        Object.keys(dbUser).forEach(key => {
          normalizedUser[key.toLowerCase()] = dbUser[key];
        });
        // 여기서 세션에 저장된 accessToken을 추가합니다.
        if (req.user.accessToken) {
          normalizedUser.accessToken = req.user.accessToken;
        }
        res.json({ user: normalizedUser });
      } else {
        res.status(404).json({ user: null, message: "User not found" });
      }
    } catch (err) {
      console.error("Error in /auth/me:", err);
      res.status(500).json({ message: err.message });
    }
  } else {
    res.status(401).json({ user: null });
  }
});

router.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) {
      console.error("Logout error:", err);
      return next(err);
    }
    req.session.destroy(function(err) {
      if (err) {
        console.error("Session destroy error:", err);
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });
});

module.exports = router;
