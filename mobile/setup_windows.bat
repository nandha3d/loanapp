@echo off
setlocal enabledelayedexpansion

echo.
echo === LoanTrack Mobile - Windows Setup ===
echo.

REM Check if Flutter is installed
if exist "C:\flutter\bin\flutter.bat" (
    echo [OK] Flutter already installed at C:\flutter
    goto PUBGET
)

echo [1/3] Installing Flutter SDK...

REM Download Flutter using curl (more reliable than PowerShell)
echo Downloading Flutter (this may take 5-10 minutes)...
curl -L -o "%temp%\flutter.zip" "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.24.0-stable.zip" 2>nul

if errorlevel 1 (
    echo.
    echo [ERROR] Download failed. Please manually download:
    echo https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.24.0-stable.zip
    echo.
    echo And extract to: C:\flutter
    goto EOF
)

echo Extracting Flutter...
powershell -Command "Expand-Archive -Path '%temp%\flutter.zip' -DestinationPath 'C:\' -Force" 2>nul
del "%temp%\flutter.zip" 2>nul

if not exist "C:\flutter\bin\flutter.bat" (
    echo [ERROR] Extraction failed. Please extract manually to C:\flutter
    goto EOF
)

echo [OK] Flutter installed

:PUBGET
echo.
echo [2/3] Installing pub dependencies...
cd /d "%~dp0"
call "C:\flutter\bin\flutter.bat" pub get
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    goto EOF
)
echo [OK] Dependencies installed

:GENERATE
echo.
echo [3/3] Generating Windows platform files...
call "C:\flutter\bin\flutter.bat" create . --project-name loantrack --org com.loantrack --platforms=windows
if errorlevel 1 (
    echo [ERROR] Failed to generate platform files
    goto EOF
)
echo [OK] Setup complete

echo.
echo === READY TO RUN ===
echo.
echo Next steps:
echo 1. Start backend: npm run dev (from repo root)
echo 2. Run app: flutter run -d windows
echo.
echo For more help, see: WINDOWS_SETUP.md
goto EOF

:EOF
pause
