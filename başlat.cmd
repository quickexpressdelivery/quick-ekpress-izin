@echo off
title Haftalik Izin Cizelgesi Sunucusu & Canli Internet Tüneli
color 0A
echo ===========================================================
echo   HAFTALIK IZIN CIZELGESI & CANLI INTERNET TUNELI BASLATILIYOR...
echo ===========================================================
echo.

cd /d "%~dp0"

echo 1/2 Sunucu Baslatiliyor...
start "" "C:\Users\user\AppData\Roaming\Antigravity\bin\agy-node.cmd" server.js

echo 2/2 Canli Internet Tüneli Baslatiliyor (Her Yerden Mobil Veri Ilgili Link)...
start "" "C:\Users\user\AppData\Roaming\Antigravity\bin\agy-node.cmd" tunnel.js

echo.
echo Sunucu ve Internet Tuneli Baslatildi!
echo -----------------------------------------------------------
echo 🌐 Yonetici Paneli: http://localhost:3000/admin
echo 📱 Calisan Portali:  http://localhost:3000/
echo -----------------------------------------------------------
echo.
echo Tarayici aciliyor...
timeout /t 3 >nul
start http://localhost:3000/admin

pause
