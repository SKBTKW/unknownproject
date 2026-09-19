@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo  AoT Safe Integration Runner
echo  Default mode: PLAN ONLY
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found in PATH.
  echo.
  pause
  exit /b 1
)

where gh >nul 2>nul
if errorlevel 1 (
  echo [ERROR] GitHub CLI ^(gh^) was not found in PATH.
  echo.
  pause
  exit /b 1
)

node scratch\safe_integration_runner.mjs %*
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" echo [BLOCKED] Safe Integration Runner exited with code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%
