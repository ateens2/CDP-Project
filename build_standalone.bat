@echo off
chcp 65001 >nul
title CDP 프로젝트 독립 실행 파일 빌드

echo =====================================
echo    🔨 CDP 프로젝트 독립 실행 파일 빌드
echo =====================================
echo.

cd /d "%~dp0"

:: 기존 dist 폴더 삭제
if exist "dist" (
    echo 🗑️ 기존 빌드 파일 삭제 중...
    rmdir /s /q dist
)

:: dist 폴더 생성
mkdir dist

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

:: 백엔드 빌드
echo 🔨 백엔드 독립 실행 파일 빌드 중...
cd ..\backend

if not exist "node_modules" (
    echo 📦 백엔드 의존성 설치 중...
    npm install
)

:: Windows 독립 실행 파일 생성
echo 🏗️ Windows 실행 파일 생성 중...
npx pkg app.js -t node18-win-x64 -o ../dist/cdp-server.exe

if errorlevel 1 (
    echo ❌ 독립 실행 파일 생성 실패!
    pause
    exit /b 1
)

:: 프론트엔드 파일 복사
echo 📁 프론트엔드 파일 복사 중...
xcopy /s /e "..\frontend\dist" "..\dist\frontend\" >nul

:: 설정 파일 복사
echo ⚙️ 설정 파일 복사 중...
if exist ".env.example" (
    copy ".env.example" "..\dist\.env" >nul
)

:: 실행 스크립트 생성
cd ..\dist
echo @echo off > run_server.bat
echo chcp 65001 ^>nul >> run_server.bat
echo title CDP 프로젝트 서버 >> run_server.bat
echo. >> run_server.bat
echo echo CDP 프로젝트 서버 시작 중... >> run_server.bat
echo start /min cmd /c "timeout /t 3 /nobreak ^>nul ^&^& start http://localhost:3000" >> run_server.bat
echo cdp-server.exe >> run_server.bat
echo pause >> run_server.bat

cd ..

echo.
echo =====================================
echo    ✅ 빌드 완료!
echo =====================================
echo.
echo 생성된 파일:
echo - dist/cdp-server.exe (독립 실행 파일)
echo - dist/run_server.bat (실행 스크립트)
echo - dist/frontend/ (웹 파일들)
echo.
echo dist 폴더를 다른 컴퓨터에 복사하여 사용하세요!
echo.
pause 