@echo off
setlocal enabledelayedexpansion

echo.
echo === LoanTrack Mobile - Setup Status Check ===
echo.

REM Check Flutter
if exist "C:\flutter\bin\flutter.bat" (
    echo [OK] Flutter SDK found at C:\flutter
    echo.
    call C:\flutter\bin\flutter.bat --version
) else (
    echo [MISSING] Flutter SDK not installed
    echo  Location: C:\flutter
    echo.
    echo ACTION REQUIRED:
    echo 1. Download Flutter from: https://flutter.dev/docs/get-started/install/windows
    echo 2. Extract to: C:\flutter
    echo 3. Run this script again
)

echo.
echo --- System Path Check ---
echo Checking for Flutter in PATH...
where flutter.bat >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Flutter not in system PATH
    echo ACTION: Add C:\flutter\bin to system environment variables
) else (
    echo [OK] Flutter is in system PATH
)

echo.
echo --- Project Check ---
cd /d "%~dp0"
if exist "pubspec.yaml" (
    echo [OK] pubspec.yaml found
) else (
    echo [ERROR] pubspec.yaml not found - not in mobile directory
)

if exist "lib" (
    echo [OK] lib directory found
) else (
    echo [ERROR] lib directory not found
)

if exist "windows" (
    echo [OK] Windows platform files exist
) else (
    echo [WARNING] Windows platform files not generated yet
    echo ACTION: Run "flutter create . --project-name loantrack --org com.loantrack --platforms=windows"
)

echo.
echo --- Dependencies Check ---
if exist ".packages" (
    echo [OK] Dependencies appear to be installed (.packages found)
) else (
    echo [WARNING] Dependencies not installed
    echo ACTION: Run "flutter pub get"
)

echo.
echo --- Backend Check ---
echo Checking if backend is running at localhost:3000...
powershell -Command "try { $web = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 2 -ErrorAction Stop; Write-Host '[OK] Backend is running'; exit 0 } catch { Write-Host '[INFO] Backend not running - start with: npm run dev'; exit 1 }" >nul 2>&1

echo.
echo === Recommendations ===
if not exist "C:\flutter\bin\flutter.bat" (
    echo 1. Install Flutter SDK
    echo    - Download from: https://flutter.dev
    echo    - Extract to: C:\flutter
)
if not exist "windows" (
    echo 2. Generate Windows platform files
    echo    - Run: flutter create . --project-name loantrack --org com.loantrack --platforms=windows
)
if not exist ".packages" (
    echo 3. Install dependencies
    echo    - Run: flutter pub get
)

echo.
echo === Ready to Run ===
echo Once setup is complete, run: flutter run -d windows
echo.
pause
