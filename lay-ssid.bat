@echo off
chcp 65001 >nul
title VTracker - Công cụ tự động lấy Cookie SSID Riot Games (30 ngày)
cd /d "%~dp0"

echo ===============================================================
echo     VTRACKER - TỰ ĐỘNG LẤY COOKIE SSID RIOT GAMES (30 NGÀY)
echo ===============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LỖI] Không tìm thấy Node.js trên máy tính của bạn!
    echo Vui lòng cài đặt Node.js từ https://nodejs.org để chạy công cụ.
    pause
    exit /b 1
)

node scripts/get-ssid.js

if %errorlevel% neq 0 (
    echo.
    echo Có lỗi xảy ra trong quá trình lấy SSID.
    pause
)
