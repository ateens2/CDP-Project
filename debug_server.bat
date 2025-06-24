@echo off
chcp 65001 >nul
title CDP 프로젝트 서버 디버그

echo =====================================
echo    🔍 CDP 프로젝트 서버 디버그 모드
echo =====================================
echo.

:: 현재 디렉토리 확인
cd /d "%~dp0"
echo 현재 위치: %CD%
echo.

:: Node.js 설치 확인
echo 📋 시스템 정보 확인...
echo.
echo [Node.js 버전]
node --version
if errorlevel 1 (
    echo ❌ Node.js가 설치되지 않았습니다!
    echo Node.js를 설치해주세요: https://nodejs.org
    goto :error_end
)

echo.
echo [npm 버전]
npm --version
if errorlevel 1 (
    echo ❌ npm이 설치되지 않았습니다!
    goto :error_end
)

echo.
echo [현재 디렉토리 구조]
dir /b
echo.

:: 폴더 존재 확인
if not exist "backend" (
    echo ❌ backend 폴더를 찾을 수 없습니다!
    echo 현재 위치: %CD%
    echo 프로젝트 루트 디렉토리에서 실행해주세요.
    goto :error_end
)

if not exist "frontend" (
    echo ❌ frontend 폴더를 찾을 수 없습니다!
    goto :error_end
)

echo ✅ 폴더 구조 확인 완료
echo.

:: 백엔드 확인
echo 🔍 백엔드 상태 확인...
cd backend

echo [백엔드 package.json 확인]
if not exist "package.json" (
    echo ❌ backend/package.json이 없습니다!
    goto :error_end
)

echo [백엔드 의존성 확인]
if not exist "node_modules" (
    echo ⚠️ backend/node_modules가 없습니다. 설치 시작...
    npm install
    if errorlevel 1 (
        echo ❌ 백엔드 의존성 설치 실패!
        goto :error_end
    )
) else (
    echo ✅ 백엔드 의존성 확인 완료
)

echo.
echo [백엔드 파일 확인]
if not exist "app.js" (
    echo ❌ app.js가 없습니다!
    goto :error_end
)

dir app.js

echo.
echo 🔍 프론트엔드 상태 확인...
cd ..\frontend

echo [프론트엔드 package.json 확인]
if not exist "package.json" (
    echo ❌ frontend/package.json이 없습니다!
    goto :error_end
)

echo [프론트엔드 의존성 확인]
if not exist "node_modules" (
    echo ⚠️ frontend/node_modules가 없습니다. 설치 시작...
    npm install
    if errorlevel 1 (
        echo ❌ 프론트엔드 의존성 설치 실패!
        goto :error_end
    )
) else (
    echo ✅ 프론트엔드 의존성 확인 완료
)

echo [프론트엔드 빌드 확인]
if not exist "dist" (
    echo ⚠️ dist 폴더가 없습니다. 빌드 시작...
    npm run build
    if errorlevel 1 (
        echo ❌ 프론트엔드 빌드 실패!
        goto :error_end
    )
) else (
    echo ✅ 프론트엔드 빌드 확인 완료
)

echo.
echo =====================================
echo    🚀 서버 시작 시도...
echo =====================================
echo.

cd ..\backend

echo 서버 시작 명령 실행: npm start
echo 에러가 발생하면 아래에 표시됩니다:
echo.

npm start

goto :end

:error_end
echo.
echo =====================================
echo    ❌ 오류가 발생했습니다!
echo =====================================
echo 위의 메시지를 확인하고 문제를 해결해주세요.

:end
echo.
echo 아무 키나 눌러서 종료하세요...
pause >nul 