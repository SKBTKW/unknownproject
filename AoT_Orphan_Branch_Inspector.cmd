@echo off
setlocal
cd /d "%~dp0"
node scratch\orphan_branch_inspector.mjs %*
set EXITCODE=%ERRORLEVEL%
endlocal & exit /b %EXITCODE%
