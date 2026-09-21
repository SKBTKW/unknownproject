@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo  AoT Unified Integration Workflow
echo ============================================================
echo.
echo  1. Audit / plan only
echo  2. Safe integration loop (one PR at a time)
echo  3. Exit
echo.
set /p "CHOICE=Select [1-3]: "

if "%CHOICE%"=="1" goto PLAN
if "%CHOICE%"=="2" goto EXECUTE
if "%CHOICE%"=="3" exit /b 0

echo.
echo [ERROR] Invalid selection.
pause
exit /b 1

:PLAN
echo.
node scratch\unified_integration_workflow.mjs --plan
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%

:EXECUTE
echo.
echo This mode may merge multiple READY PRs, but always ONE AT A TIME.
echo Every merge must pass Merge Decision Proof / CI / post-merge gates.
echo Successful merge cleanup removes only the proof-bound TASK branch/worktree.
echo.
set /p "CONFIRM=Type INTEGRATE to continue: "
if not "%CONFIRM%"=="INTEGRATE" (
  echo.
  echo Cancelled. Nothing was merged.
  pause
  exit /b 0
)
echo.
node scratch\unified_integration_workflow.mjs --execute-all --confirm INTEGRATE
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo [BLOCKED] Workflow stopped safely with code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%