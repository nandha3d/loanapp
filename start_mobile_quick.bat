@echo off
title ZoloFund Mobile (Quick Launch)

if exist "%~dp0mobile\build\windows\x64\runner\Debug\mobile.exe" (
    echo Starting pre-compiled ZoloFund Mobile App...
    start "" "%~dp0mobile\build\windows\x64\runner\Debug\mobile.exe"
    exit /b
)

echo Pre-compiled app not found, launching full build...
call "%~dp0start_mobile_windows.bat"
