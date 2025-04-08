require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const authRoutes = require('./routes/auth');

const app = express();

// CORS 미들웨어: 프론트엔드 URL과 쿠키 전달을 허용
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// express-session 설정: sameSite 옵션 추가
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // HTTP 환경에서는 false
    sameSite: 'lax',
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// 라우트 등록
app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Home Page - User: ' + (req.user ? req.user.displayName : 'Not logged in'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
