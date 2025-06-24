@echo off
chcp 65001 >nul
title CDP 프로젝트 서버

echo =====================================
echo    CDP 프로젝트 서버 시작 중...
echo =====================================
echo.

:: 현재 디렉토리 확인
cd /d "%~dp0"
echo 현재 위치: %CD%

:: Node.js 설치 확인
echo Node.js 확인 중...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js가 설치되지 않았습니다!
    echo Node.js를 설치해주세요: https://nodejs.org
    pause
    exit /b 1
)

:: npm 확인
echo npm 확인 중...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm이 설치되지 않았습니다!
    pause
    exit /b 1
)

echo ✅ Node.js 및 npm 확인 완료
echo.

:: 기존 서버 종료
echo 기존 서버 프로세스 종료 중...
taskkill /f /im node.exe >nul 2>&1

:: 백엔드 디렉토리로 이동
if not exist "backend" (
    echo ❌ backend 폴더를 찾을 수 없습니다!
    echo 프로젝트 루트 디렉토리에서 실행해주세요.
    pause
    exit /b 1
)

cd backend

:: 백엔드 의존성 확인
if not exist "node_modules" (
    echo 📦 백엔드 의존성 설치 중...
    npm install
    if errorlevel 1 (
        echo ❌ 백엔드 의존성 설치에 실패했습니다!
        pause
        exit /b 1
    )
)

:: 프론트엔드 빌드 확인
cd ..\frontend
if not exist "dist" (
    echo 🔨 프론트엔드 빌드 중...
    
    :: 프론트엔드 의존성 확인
    if not exist "node_modules" (
        echo 📦 프론트엔드 의존성 설치 중...
        npm install
        if errorlevel 1 (
            echo ❌ 프론트엔드 의존성 설치에 실패했습니다!
            pause
            exit /b 1
        )
    )
    
    npm run build
    if errorlevel 1 (
        echo ❌ 프론트엔드 빌드에 실패했습니다!
        pause
        exit /b 1
    )
    echo ✅ 프론트엔드 빌드 완료
)

:: 백엔드로 돌아가서 서버 시작
cd ..\backend

echo.
echo =====================================
echo    🚀 서버 시작 중...
echo =====================================
echo.
echo 서버 주소: http://localhost:3000
echo 종료하려면: Ctrl+C
echo.

:: 3초 후 브라우저 열기 (백그라운드)
start /min cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: 서버 시작 (포그라운드)
npm start

:: 에러 발생 시 처리
if errorlevel 1 (
    echo.
    echo ❌ 서버 시작에 실패했습니다!
    echo 위의 에러 메시지를 확인해주세요.
    echo.
    pause
    exit /b 1
)

:: 서버 종료 시 정리
echo.
echo =====================================
echo    서버가 종료되었습니다.
echo =====================================
pause 