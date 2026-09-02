@echo off
cd /d "%~dp0"

start "The Age of Trials Server" cmd /k "python scratch\playtest_server.py --port 8000"

timeout /t 1 /nobreak >nul

start "" "http://localhost:8000/"

exit
