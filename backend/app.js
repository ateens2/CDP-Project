require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const authRoutes = require('./routes/auth');
const sheetsRoutes = require('./routes/sheets');
const excelRoutes = require('./routes/excel');
const auditLogRoutes = require('./routes/auditLog');

const app = express();

// CORS 미들웨어: 프론트엔드 URL과 쿠키 전달을 허용
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 프론트엔드 정적 파일 서빙
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// express-session 설정: sameSite 옵션 추가
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // HTTP 환경에서는 false
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24시간
    httpOnly: true, // XSS 방지
  },
  rolling: true, // 활동 시마다 세션 갱신
}));

app.use(passport.initialize());
app.use(passport.session());

// 라우트 등록
app.use('/auth', authRoutes);
app.use('/api/sheets', sheetsRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/auditlog', auditLogRoutes);

// 루트 경로에서 React 앱 반환
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// SPA 라우팅을 위한 fallback (API 경로가 아닌 경우만)
app.use((req, res, next) => {
  // API 요청인 경우 다음 미들웨어로
  if (req.path.startsWith('/auth') || req.path.startsWith('/api')) {
    return next();
  }
  // React 앱 반환
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
