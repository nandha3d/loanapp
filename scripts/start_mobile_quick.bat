@echo off
title ZoloFund Mobile (Quick Launch)

if exist "%~dp0mobile\build\windows\x64\runner\Release\mobile.exe" goto :launch_release
if exist "%~dp0mobile\build\windows\x64\runner\Debug\mobile.exe" goto :launch_debug

echo Pre-compiled app not found, launching full build...
call "%~dp0start_mobile_windows.bat"
exit /b

:launch_release
echo Starting pre-compiled ZoloFund Mobile App [Release]...
echo [Tip: Run 'start_mobile_windows.bat' to recompile with hot reload]
start "" /d "%~dp0mobile\build\windows\x64\runner\Release" "%~dp0mobile\build\windows\x64\runner\Release\mobile.exe"
exit /b

:launch_debug
echo Starting pre-compiled ZoloFund Mobile App [Debug]...
echo [Tip: Run 'start_mobile_windows.bat' to recompile with hot reload]
start "" /d "%~dp0mobile\build\windows\x64\runner\Debug" "%~dp0mobile\build\windows\x64\runner\Debug\mobile.exe"
exit /b
