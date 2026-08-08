@echo off
title School Admission Management System Launcher
echo ====================================================
echo  Admission Management System - Local Launcher
echo ====================================================
echo.

echo [1/3] Terminating any existing server process on port 8080...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Wait briefly for socket release
powershell -NoProfile -Command "Start-Sleep -Milliseconds 600"

echo [2/3] Starting Server on port 8080...
where node >nul 2>&1 && (
    echo Launching Node.js Express Server...
    start "Admission System Server" cmd /k "npm start"
) || (
    echo Launching PowerShell Web Server...
    start "Admission System Server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_server.ps1"
)

:: Wait for server & DB initialization
powershell -NoProfile -Command "Start-Sleep -Seconds 2"

echo [3/3] Opening login portal in default browser...
start http://localhost:8080/login

echo.
echo ====================================================
echo  Server running at http://localhost:8080/
echo  Super Admin Portal: http://localhost:8080/superuser
echo ====================================================
echo.
powershell -NoProfile -Command "Start-Sleep -Seconds 3"
