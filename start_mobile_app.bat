@echo off
title ZoloFund Mobile Web App Launcher
echo ========================================================
echo          ZoloFund Flutter Mobile Web Launcher          
echo ========================================================
echo.
cd /d "%~dp0\mobile"

echo Starting Flutter Web on port 8080...
echo Access the mobile app at: http://localhost:8080
echo.

flutter run -d chrome --web-port 8080

pause
