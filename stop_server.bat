@echo off
chcp 65001 >nul
title CDP 프로젝트 서버 종료

echo =====================================
echo    🛑 서버 종료 중...
echo =====================================

:: Node.js 프로세스 종료
taskkill /f /im node.exe >nul 2>&1

if errorlevel 1 (
    echo ℹ️  실행 중인 Node.js 서버가 없습니다.
) else (
    echo ✅ 서버가 종료되었습니다.
)

echo.
echo 종료 완료!
timeout /t 3 /nobreak >nul 