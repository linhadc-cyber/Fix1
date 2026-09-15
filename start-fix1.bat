@echo off
cd /d "%~dp0"
echo Starting Fix1 on port 5051 (LAN)...
echo Open http://localhost:5051 on this PC
echo Other PCs: http://THIS-PC-IP:5051
echo.
call npm run start
pause
