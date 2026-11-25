@echo off
title ZoloFund Mobile Windows App
echo ========================================================
echo          ZoloFund Mobile App Launcher (Windows)          
echo ========================================================
echo.
echo Target Backend API: http://localhost:3000/api/v1
echo.

:: Check if Next.js is running on port 3000
netstat -ano | findstr /R /C:":3000 " >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Next.js backend server does NOT seem to be running on port 3000!
    echo Please make sure you have run 'start_app.bat' or 'npm run dev'.
    echo.
) else (
    echo [OK] Next.js backend server is running on port 3000.
    echo.
)

cd /d "%~dp0mobile"

echo Starting Flutter Windows App...
echo [Hot reload: press 'r' ^| Hot restart: press 'R' ^| Quit: press 'q']
echo.

flutter run -d windows --dart-define=API_BASE_URL=http://localhost:3000/api/v1

pause
