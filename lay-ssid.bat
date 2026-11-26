@echo off
setlocal
cd /d "%~dp0"
title VTracker - Riot Games SSID Cookie Helper

echo ===============================================================
echo     VTRACKER - RIOT GAMES SSID COOKIE HELPER
echo ===============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto node_missing

node scripts\get-ssid.js
set "script_exit_code=%errorlevel%"

if not "%script_exit_code%"=="0" (
    echo.
    echo [ERROR] SSID helper exited with code %script_exit_code%.
    pause
)

exit /b %script_exit_code%

:node_missing
echo [ERROR] Node.js was not found on this computer.
echo Install Node.js from https://nodejs.org and run this file again.
pause
exit /b 1
