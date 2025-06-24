@echo off
chcp 65001 >nul
title CDP 프로젝트 - 빠른 시작

echo ⚡ CDP 프로젝트 빠른 시작...

:: 현재 디렉토리로 이동
cd /d "%~dp0"

:: 기존 서버 종료
taskkill /f /im node.exe >nul 2>&1

:: 서버 시작 및 브라우저 열기
cd backend
start /min cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"
npm start 