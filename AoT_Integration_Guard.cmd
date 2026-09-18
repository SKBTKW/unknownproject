@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo  AoT Integration Guard V1 - Read Only
ECHO ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found in PATH.
  echo.
  pause
  exit /b 1
)

node scratch\integration_guard.mjs %*
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" echo [BLOCKED] Integration Guard exited with code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%
