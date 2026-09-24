@echo off
title ZoloFund Mobile (Quick Launch)

if exist "%~dp0mobile\build\windows\x64\runner\Release\mobile.exe" (
    echo Starting pre-compiled ZoloFund Mobile App (Release)...
    echo (Note: If you edit Flutter code, run 'start_mobile_windows.bat' to recompile with hot reload)
    start "" /d "%~dp0mobile\build\windows\x64\runner\Release" "%~dp0mobile\build\windows\x64\runner\Release\mobile.exe"
    exit /b
)

if exist "%~dp0mobile\build\windows\x64\runner\Debug\mobile.exe" (
    echo Starting pre-compiled ZoloFund Mobile App (Debug)...
    echo (Note: If you edit Flutter code, run 'start_mobile_windows.bat' to recompile with hot reload)
    start "" /d "%~dp0mobile\build\windows\x64\runner\Debug" "%~dp0mobile\build\windows\x64\runner\Debug\mobile.exe"
    exit /b
)

echo Pre-compiled app not found, launching full build...
call "%~dp0start_mobile_windows.bat"
