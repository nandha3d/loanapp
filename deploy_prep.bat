@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "STANDALONE=%ROOT%\.next\standalone"
set "ZIP=%ROOT%\loanapp-standalone-hostinger.zip"

echo ========================================================
echo LoanTrack Hostinger Standalone Deploy Prep
echo ========================================================
echo Project: %ROOT%
echo.

cd /d "%ROOT%" || goto :fail

echo [1/8] Cleaning old build artifacts...
echo   Stopping local Node processes that reference this project...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$root='%ROOT%'.Replace('\','\\');" ^
  "Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" | Where-Object { $_.CommandLine -like ('*' + $root + '*') -or $_.CommandLine -like '*loanapp*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>nul

if exist "%ROOT%\.next" rmdir /s /q "%ROOT%\.next" || goto :fail
if exist "%ROOT%\node_modules\.cache" rmdir /s /q "%ROOT%\node_modules\.cache" || goto :fail
if exist "%ZIP%" del /f /q "%ZIP%" || goto :fail

echo.
echo [2/8] Generating Prisma Client...
call :run_prisma_generate || goto :fail

echo.
echo [3/8] Building Next.js standalone output...
call npm run build || goto :fail

echo.
echo [4/8] Locating standalone folder...
if not exist "%STANDALONE%" (
  echo ERROR: Standalone folder was not created: %STANDALONE%
  echo Check that next.config.ts contains: output: 'standalone'
  goto :fail
)

if not exist "%STANDALONE%\server.js" (
  for /f "delims=" %%F in ('dir /b /s "%STANDALONE%\server.js" 2^>nul') do (
    set "NESTED_SERVER=%%F"
    goto :found_nested_server
  )
)

:found_nested_server
if defined NESTED_SERVER (
  echo ERROR: server.js is nested instead of being at the standalone root:
  echo   !NESTED_SERVER!
  echo.
  echo Fix next.config.ts by adding:
  echo   turbopack: ^{ root: process.cwd^(^) ^},
  echo Then rerun this script.
  goto :fail
)

if not exist "%STANDALONE%\server.js" (
  echo ERROR: server.js not found in %STANDALONE%
  goto :fail
)

echo Standalone root: %STANDALONE%

echo.
echo [5/8] Copying runtime assets into standalone folder...
call :copy_dir "%ROOT%\public" "%STANDALONE%\public" || goto :fail
if exist "%ROOT%\private" call :copy_dir "%ROOT%\private" "%STANDALONE%\private" || goto :fail
call :copy_dir "%ROOT%\.next\static" "%STANDALONE%\.next\static" || goto :fail

echo.
echo [6/8] Copying physical Prisma folders...
call :copy_dir "%ROOT%\node_modules\.prisma" "%STANDALONE%\node_modules\.prisma" || goto :fail
call :copy_dir "%ROOT%\node_modules\@prisma" "%STANDALONE%\node_modules\@prisma" || goto :fail
call :copy_dir "%ROOT%\.next\node_modules\@prisma" "%STANDALONE%\.next\node_modules\@prisma" || goto :fail

echo.
echo [7/8] Removing local env files from deploy payload...
for %%E in (".env" ".env.local" ".env_prod" ".env.production" ".env.production.local") do (
  if exist "%STANDALONE%\%%~E" (
    echo   Removing %%~E
    del /f /q "%STANDALONE%\%%~E" || goto :fail
  )
)

echo   Removing Windows-only Prisma engine files from deploy payload...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "Get-ChildItem -LiteralPath '%STANDALONE%' -Recurse -Force -File | Where-Object { $_.Name -eq 'query_engine-windows.dll.node' -or $_.Name -like 'query_engine-windows.dll.node.tmp*' } | Remove-Item -Force" >nul 2>nul

echo.
@REM echo [8/8] Validating and zipping standalone contents...
@REM call :require_path "%STANDALONE%\server.js" || goto :fail
@REM call :require_path "%STANDALONE%\package.json" || goto :fail
@REM call :require_path "%STANDALONE%\node_modules" || goto :fail
@REM call :require_path "%STANDALONE%\.next\server" || goto :fail
@REM call :require_path "%STANDALONE%\.next\static" || goto :fail
@REM call :require_path "%STANDALONE%\public" || goto :fail
@REM call :require_path "%STANDALONE%\node_modules\.prisma" || goto :fail
@REM call :require_path "%STANDALONE%\node_modules\@prisma" || goto :fail
@REM call :require_path "%STANDALONE%\.next\node_modules\@prisma" || goto :fail

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Add-Type -AssemblyName System.IO.Compression;" ^
  "Add-Type -AssemblyName System.IO.Compression.FileSystem;" ^
  "$root=(Resolve-Path -LiteralPath '%STANDALONE%').Path;" ^
  "$zipPath='%ZIP%';" ^
  "if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force };" ^
  "$zip=[System.IO.Compression.ZipFile]::Open($zipPath,[System.IO.Compression.ZipArchiveMode]::Create);" ^
  "try {" ^
  "  Get-ChildItem -LiteralPath $root -Recurse -Force -File | ForEach-Object {" ^
  "    $relative=$_.FullName.Substring($root.Length).TrimStart('\','/').Replace('\','/');" ^
  "    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$_.FullName,$relative,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null;" ^
  "  };" ^
  "} finally { $zip.Dispose() };" ^
  "if (-not (Test-Path -LiteralPath $zipPath)) { throw 'Zip was not created' }" || goto :fail

echo.
echo ========================================================
echo SUCCESS
echo ========================================================
echo Zip created:
echo   %ZIP%
echo.
echo The zip contains the CONTENTS of:
echo   %STANDALONE%
echo.
echo Hostinger clean replace commands:
echo   cd ~/domains/springgreen-emu-806212.hostingersite.com/nodejs
echo   pkill -u $USER node
echo   pkill -u $USER lsnode
echo   rm -rf .next node_modules public private server.js package.json
echo.
echo Start command:
echo   /opt/alt/alt-nodejs22/root/bin/node --v8-pool-size=1 server.js
echo ========================================================
goto :end

:copy_dir
set "SRC=%~1"
set "DST=%~2"
if not exist "%SRC%" (
  echo ERROR: Required source folder missing:
  echo   %SRC%
  exit /b 1
)
if exist "%DST%" rmdir /s /q "%DST%" || exit /b 1
mkdir "%DST%" || exit /b 1
robocopy "%SRC%" "%DST%" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo ERROR: Failed to copy:
  echo   %SRC%
  echo to:
  echo   %DST%
  exit /b 1
)
exit /b 0

:require_path
if not exist "%~1" (
  echo ERROR: Required deploy path missing:
  echo   %~1
  exit /b 1
)
exit /b 0

:run_prisma_generate
call npx prisma generate
if not errorlevel 1 exit /b 0

echo.
echo Prisma generate failed. Waiting briefly and retrying once...
timeout /t 3 /nobreak >nul

for %%F in ("%ROOT%\node_modules\.prisma\client\query_engine-windows.dll.node.tmp*") do (
  if exist "%%~fF" del /f /q "%%~fF" >nul 2>nul
)

call npx prisma generate
if errorlevel 1 (
  echo.
  echo ERROR: Prisma Client generation failed.
  echo If this is an EPERM rename error, close any running local dev server or Node process using this project, then rerun:
  echo   deploy_prep.bat /nopause
  exit /b 1
)
exit /b 0

:fail
echo.
echo ========================================================
echo FAILED
echo ========================================================
echo Deploy package was not completed.
exit /b 1

:end
if /i "%~1"=="/nopause" exit /b 0
pause
