@echo off
title ZoloFund Application Launcher
echo ========================================================
echo               ZoloFund Application Launcher
echo ========================================================
echo.
cd /d "%~dp0"

echo Starting Next.js Development Server...
echo Access the app at: http://localhost:3000
echo.

npm run dev

pause
