@echo off
chcp 65001 >nul
title CDP 프로젝트 데스크톱 앱 빌드

echo =====================================
echo    🖥️ CDP 프로젝트 데스크톱 앱 빌드
echo =====================================
echo.

cd /d "%~dp0"

:: 기존 빌드 폴더 삭제
if exist "electron-dist" (
    echo 🗑️ 기존 빌드 파일 삭제 중...
    rmdir /s /q electron-dist
)

:: 프론트엔드 빌드
echo 🔨 프론트엔드 빌드 중...
cd frontend
if not exist "node_modules" (
    echo 📦 프론트엔드 의존성 설치 중...
    npm install
)

npm run build
if errorlevel 1 (
    echo ❌ 프론트엔드 빌드 실패!
    pause
    exit /b 1
)

echo ✅ 프론트엔드 빌드 완료

:: 백엔드 의존성 확인
echo 🔍 백엔드 의존성 확인 중...
cd ..\backend
if not exist "node_modules" (
    echo 📦 백엔드 의존성 설치 중...
    npm install
)

:: Electron 의존성 설치
echo 📦 Electron 의존성 설치 중...
cd ..
copy electron-package.json package.json >nul

npm install

:: Electron 앱 빌드
echo 🖥️ Electron 앱 빌드 중...
npx electron-builder --win

if errorlevel 1 (
    echo ❌ Electron 앱 빌드 실패!
    pause
    exit /b 1
)

echo.
echo =====================================
echo    ✅ 데스크톱 앱 빌드 완료!
echo =====================================
echo.
echo 생성된 파일:
dir electron-dist
echo.
echo electron-dist 폴더에서 설치 파일을 확인하세요!
echo.
pause 