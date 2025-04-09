// src/pages/InitialPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './InitialPage.css';

const InitialPage = () => {
  const [screen, setScreen] = useState(1);
  const navigate = useNavigate();

  const handleNext = () => {
    setScreen(2);
  };

  const handleStartWithGoogle = () => {
    navigate('/login');
  };

  return (
    <div className="initial-page">
      <div
        className="screen-container"
        style={{
          transform: screen === 2 ? 'translateY(-100vh)' : 'translateY(0)',
        }}
      >
        {/* 첫 번째 화면 */}
        <div className="screen screen1">
          <h1 className="title">Sheet 복사로부터</h1>
          <h2 className="subtitle">당신의 종이를 아끼세요</h2>
          <button className="next-button" onClick={handleNext}>Next</button>
        </div>
        {/* 두 번째 화면 */}
        <div className="screen screen2">
          <h1 className="title">당신의 구글 아이디로 시작할 수 있습니다</h1>
          <button className="google-button" onClick={handleStartWithGoogle}>
            Start with your Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default InitialPage;
