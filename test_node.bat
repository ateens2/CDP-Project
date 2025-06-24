@echo off
chcp 65001 >nul
title Node.js 테스트

echo =====================================
echo    Node.js 기본 테스트
echo =====================================
echo.

cd /d "%~dp0"
echo 현재 위치: %CD%
echo.

echo [Node.js 확인]
node --version
echo.

echo [npm 확인] 
npm --version
echo.

echo [폴더 구조]
dir
echo.

echo [backend 폴더 확인]
if exist "backend" (
    echo ✅ backend 폴더 존재
    cd backend
    echo backend 내용:
    dir
    cd ..
) else (
    echo ❌ backend 폴더 없음
)

echo.
echo [frontend 폴더 확인]
if exist "frontend" (
    echo ✅ frontend 폴더 존재
    cd frontend
    echo frontend 내용:
    dir
    cd ..
) else (
    echo ❌ frontend 폴더 없음
)

echo.
echo 테스트 완료. 아무 키나 눌러서 종료...
pause >nul 