@echo off
cd /d "%~dp0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr LISTENING ^| findstr :5173') do taskkill /PID %%a /F >nul 2>nul
start cmd /k daemon-debug.bat
echo SpeakBetter server is starting...
echo Open on this computer: http://localhost:5173
echo Open on phone in same Wi-Fi: http://你的电脑局域网IP:5173
