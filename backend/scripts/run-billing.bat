@echo off
REM ============================================================
REM 구독 정기결제 배치 실행 (윈도우 작업 스케줄러용)
REM 이 파일을 작업 스케줄러에 등록하면 매일 자동 실행됩니다.
REM ============================================================

REM 백엔드 폴더로 이동 (이 .bat 파일 기준 한 단계 상위)
cd /d "%~dp0.."

REM 로그 폴더 생성
if not exist "logs" mkdir "logs"

REM 날짜(YYYYMMDD) 기반 로그 파일명
set "LOGDATE=%date:~0,4%%date:~5,2%%date:~8,2%"
set "LOGFILE=logs\billing_%LOGDATE%.log"

echo ============================================== >> "%LOGFILE%"
echo [%date% %time%] runBilling 실행 시작 >> "%LOGFILE%"

REM node 가 PATH 에 없으면 아래 줄을 전체 경로로 바꾸세요.
REM 예) "C:\Program Files\nodejs\node.exe" scripts\runBilling.js
node scripts\runBilling.js >> "%LOGFILE%" 2>&1

echo [%date% %time%] runBilling 실행 종료 (exit=%errorlevel%) >> "%LOGFILE%"
exit /b %errorlevel%
