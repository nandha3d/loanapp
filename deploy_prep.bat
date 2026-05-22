@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "STANDALONE=%ROOT%\.next\standalone"
set "ZIP_NAME=loanapp-standalone-hostinger.zip"
set "ZIP=%ROOT%\%ZIP_NAME%"
set "REMOTE_USER=u362580417"
set "REMOTE_HOST=217.21.74.44"
set "REMOTE_PORT=65002"
set "REMOTE_DOMAIN=springgreen-emu-806212.hostingersite.com"
set "REMOTE_DOMAIN_DIR=~/domains/%REMOTE_DOMAIN%"
set "REMOTE_APP_DIR=%REMOTE_DOMAIN_DIR%/nodejs"
set "REMOTE_ZIP=%REMOTE_APP_DIR%/%ZIP_NAME%"
set "REMOTE_NODE=/opt/alt/alt-nodejs22/root/bin/node"
set "DEPLOY_MODE=update"
set "INCLUDE_ENV=0"
set "DB_MODE=migrate"
set "DO_UPLOAD=1"
set "DO_START=1"
set "DO_PAUSE=1"
set "ALLOW_DBPUSH=0"

for %%A in (%*) do (
  if /i "%%~A"=="/update" (
    set "DEPLOY_MODE=update"
    set "INCLUDE_ENV=0"
  )
  if /i "%%~A"=="/fresh" (
    set "DEPLOY_MODE=fresh"
    set "INCLUDE_ENV=1"
  )
  if /i "%%~A"=="/include-env" set "INCLUDE_ENV=1"
  if /i "%%~A"=="/prep-only" set "DO_UPLOAD=0"
  if /i "%%~A"=="/skip-db" set "DB_MODE=skip"
  if /i "%%~A"=="/dbpush" set "DB_MODE=dbpush"
  if /i "%%~A"=="/allow-dbpush" set "ALLOW_DBPUSH=1"
  if /i "%%~A"=="/no-start" set "DO_START=0"
  if /i "%%~A"=="/nopause" set "DO_PAUSE=0"
)

if /i "%DB_MODE%"=="dbpush" if not "%ALLOW_DBPUSH%"=="1" (
  echo ERROR: /dbpush is blocked for production safety.
  echo Use normal updates with: deploy_prep.bat /update
  echo If you intentionally need Prisma db push, rerun with: /dbpush /allow-dbpush
  goto :fail
)

echo ========================================================
echo LoanTrack Hostinger Build + Deploy
echo ========================================================
echo Project:      %ROOT%
echo Remote SSH:   ssh -p %REMOTE_PORT% %REMOTE_USER%@%REMOTE_HOST%
echo Remote app:   %REMOTE_APP_DIR%
echo Mode:         %DEPLOY_MODE%
echo Database:     %DB_MODE%
echo Include .env: %INCLUDE_ENV%
echo Start app:    %DO_START%
echo.

cd /d "%ROOT%" || goto :fail

echo [1/11] Checking local tools...
where powershell >nul 2>nul || (echo ERROR: powershell was not found.& goto :fail)
where scp >nul 2>nul || (echo ERROR: scp was not found. Install/enable Windows OpenSSH Client.& goto :fail)
where ssh >nul 2>nul || (echo ERROR: ssh was not found. Install/enable Windows OpenSSH Client.& goto :fail)

echo.
echo [2/11] Cleaning old build artifacts...
echo   Stopping local Node processes that reference this project...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$root='%ROOT%'.Replace('\','\\');" ^
  "Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" | Where-Object { $_.CommandLine -like ('*' + $root + '*') -or $_.CommandLine -like '*loanapp*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>nul

if exist "%ROOT%\.next" rmdir /s /q "%ROOT%\.next" || goto :fail
if exist "%ROOT%\node_modules\.cache" rmdir /s /q "%ROOT%\node_modules\.cache" || goto :fail
if exist "%ZIP%" del /f /q "%ZIP%" || goto :fail

echo.
echo [3/11] Validating Prisma schema...
call npx prisma validate || goto :fail

echo.
echo [4/11] Generating Prisma Client...
call :run_prisma_generate || goto :fail

echo.
echo [5/11] Building Next.js standalone output...
call npm run build || goto :fail

echo.
echo [6/11] Locating standalone folder...
if not exist "%STANDALONE%" (
  echo ERROR: Standalone folder was not created: %STANDALONE%
  echo Check that next.config.ts contains: output: 'standalone'
  goto :fail
)

set "NESTED_SERVER="
if not exist "%STANDALONE%\server.js" (
  for /f "delims=" %%F in ('dir /b /s "%STANDALONE%\server.js" 2^>nul') do (
    set "NESTED_SERVER=%%F"
    goto :found_nested_server
  )
)

:found_nested_server
if defined NESTED_SERVER (
  echo ERROR: server.js is nested instead of being at the standalone root:
  echo   %NESTED_SERVER%
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
echo [7/11] Copying runtime assets into standalone folder...
call :copy_dir "%ROOT%\public" "%STANDALONE%\public" || goto :fail
if exist "%ROOT%\private" call :copy_dir "%ROOT%\private" "%STANDALONE%\private" || goto :fail
call :copy_dir "%ROOT%\.next\static" "%STANDALONE%\.next\static" || goto :fail

echo.
echo [8/11] Copying Prisma runtime, schema, migrations, and CLI...
call :copy_dir "%ROOT%\prisma" "%STANDALONE%\prisma" || goto :fail
if exist "%STANDALONE%\prisma\generated-client" rmdir /s /q "%STANDALONE%\prisma\generated-client" || goto :fail
call :copy_dir "%ROOT%\node_modules\.prisma" "%STANDALONE%\node_modules\.prisma" || goto :fail
call :copy_dir "%ROOT%\node_modules\@prisma" "%STANDALONE%\node_modules\@prisma" || goto :fail
call :copy_dir "%ROOT%\node_modules\prisma" "%STANDALONE%\node_modules\prisma" || goto :fail
if exist "%ROOT%\.next\node_modules" call :copy_dir "%ROOT%\.next\node_modules" "%STANDALONE%\.next\node_modules" || goto :fail

echo.
echo [9/11] Removing local-only files from deploy payload...
for %%E in (".env" ".env.local" ".env_prod" ".env.production" ".env.production.local") do (
  if exist "%STANDALONE%\%%~E" (
    echo   Removing %%~E
    del /f /q "%STANDALONE%\%%~E" || goto :fail
  )
)

if "%INCLUDE_ENV%"=="1" (
  if exist "%ROOT%\.env_prod" (
    echo   Adding .env from .env_prod for first-time/fresh deploy...
    copy /y "%ROOT%\.env_prod" "%STANDALONE%\.env" >nul || goto :fail
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%STANDALONE%\.env'; $t=Get-Content -LiteralPath $p -Raw; $t=$t -replace \"`r?`n\", \"`n\"; [System.IO.File]::WriteAllText($p, $t, [System.Text.Encoding]::ASCII)" || goto :fail
  ) else (
    echo ERROR: /fresh or /include-env was requested, but .env_prod was not found.
    goto :fail
  )
) else (
  echo   Preserving remote .env; package will not overwrite production secrets.
)

echo   Removing Windows-only Prisma engine files from deploy payload...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "Get-ChildItem -LiteralPath '%STANDALONE%' -Recurse -Force -File | Where-Object { $_.Name -eq 'query_engine-windows.dll.node' -or $_.Name -like 'query_engine-windows.dll.node.tmp*' } | Remove-Item -Force" >nul 2>nul

echo.
echo [10/11] Validating and zipping standalone contents with forward-slash paths...
call :require_path "%STANDALONE%\server.js" || goto :fail
call :require_path "%STANDALONE%\package.json" || goto :fail
call :require_path "%STANDALONE%\node_modules" || goto :fail
call :require_path "%STANDALONE%\.next\server" || goto :fail
call :require_path "%STANDALONE%\.next\static" || goto :fail
call :require_path "%STANDALONE%\public" || goto :fail
call :require_path "%STANDALONE%\prisma\schema.prisma" || goto :fail
call :require_path "%STANDALONE%\prisma\migrations" || goto :fail
call :require_path "%STANDALONE%\node_modules\.prisma" || goto :fail
call :require_path "%STANDALONE%\node_modules\@prisma" || goto :fail
call :require_path "%STANDALONE%\node_modules\prisma\build\index.js" || goto :fail
call :require_path "%STANDALONE%\.next\node_modules" || goto :fail

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
  "    if ($relative.Contains('\')) { throw ('Backslash path leaked into zip: ' + $relative) }" ^
  "    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$_.FullName,$relative,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null;" ^
  "  };" ^
  "} finally { $zip.Dispose() };" ^
  "$entries=[System.IO.Compression.ZipFile]::OpenRead($zipPath);" ^
  "try { if (($entries.Entries | Where-Object { $_.FullName -like '*\*' }).Count -gt 0) { throw 'Zip contains Windows backslash paths' } } finally { $entries.Dispose() };" ^
  "if (-not (Test-Path -LiteralPath $zipPath)) { throw 'Zip was not created' }" || goto :fail

if "%DO_UPLOAD%"=="0" goto :success_prep_only

echo.
echo [11/11] Uploading and deploying on Hostinger...
call :write_remote_script || goto :fail

echo   Uploading zip...
scp -P %REMOTE_PORT% "%ZIP%" "%REMOTE_USER%@%REMOTE_HOST%:%REMOTE_ZIP%" || goto :fail

echo   Running remote deployment...
ssh -p %REMOTE_PORT% "%REMOTE_USER%@%REMOTE_HOST%" "export DEPLOY_MODE=%DEPLOY_MODE% DB_MODE=%DB_MODE% DO_START=%DO_START%; tr -d '\r' | bash" < "%TEMP%\loanapp_hostinger_deploy.sh" || goto :fail

goto :success

:write_remote_script
> "%TEMP%\loanapp_hostinger_deploy.sh" (
  echo set -euo pipefail
  echo DOMAIN_DIR="$HOME/domains/%REMOTE_DOMAIN%"
  echo APP_DIR="$DOMAIN_DIR/nodejs"
  echo ZIP_PATH="$APP_DIR/%ZIP_NAME%"
  echo NEW_DIR="$DOMAIN_DIR/.deploy_new_$$"
  echo BACKUP_DIR="$DOMAIN_DIR/deploy_backups/$(date +%%Y%%m%%d_%%H%%M%%S)"
  echo NODE="%REMOTE_NODE%"
  echo echo "Remote domain: $DOMAIN_DIR"
  echo echo "Remote app:    $APP_DIR"
  echo echo "Deploy mode:   ${DEPLOY_MODE:-update}"
  echo echo "Database mode: $DB_MODE"
  echo mkdir -p "$APP_DIR" "$DOMAIN_DIR/deploy_backups"
  echo if [ ! -f "$ZIP_PATH" ]; then echo "ERROR: Uploaded zip not found: $ZIP_PATH"; exit 1; fi
  echo rm -rf "$NEW_DIR"
  echo mkdir -p "$NEW_DIR"
  echo echo "Extracting uploaded package..."
  echo if command -v unzip ^> /dev/null 2^>^&1; then unzip -q "$ZIP_PATH" -d "$NEW_DIR"; else python3 -m zipfile -e "$ZIP_PATH" "$NEW_DIR"; fi
  echo test -f "$NEW_DIR/server.js" ^|^| ^(echo "ERROR: server.js missing after unzip"; exit 1^)
  echo test -f "$NEW_DIR/prisma/schema.prisma" ^|^| ^(echo "ERROR: prisma/schema.prisma missing after unzip"; exit 1^)
  echo test -d "$NEW_DIR/prisma/migrations" ^|^| ^(echo "ERROR: prisma/migrations missing after unzip"; exit 1^)
  echo echo "Stopping this app on port 3000, if running..."
  echo if command -v fuser ^> /dev/null 2^>^&1; then fuser -k 3000/tcp ^> /dev/null 2^>^&1 ^|^| true; fi
  echo if command -v lsof ^> /dev/null 2^>^&1; then lsof -ti:3000 ^| xargs -r kill -TERM ^|^| true; fi
  echo old_pids="$(ps ux | grep 'next-server (v16.2.6)' | grep -v grep | awk '{print $2}')"
  echo if [ -n "$old_pids" ]; then echo "Stopping stale Next.js PIDs: $old_pids"; kill $old_pids 2^> /dev/null ^|^| true; fi
  echo sleep 2
  echo if [ -n "${old_pids:-}" ]; then kill -9 $old_pids 2^> /dev/null ^|^| true; fi
  echo mkdir -p "$BACKUP_DIR"
  echo if [ -f "$APP_DIR/.env" ]; then cp "$APP_DIR/.env" "$BACKUP_DIR/.env"; fi
  echo for item in .next node_modules prisma public private server.js package.json package-lock.json standalone.zip; do if [ -e "$APP_DIR/$item" ]; then mv "$APP_DIR/$item" "$BACKUP_DIR/$item"; fi; done
  echo cp -a "$NEW_DIR"/. "$APP_DIR"/
  echo rm -rf "$NEW_DIR"
  echo rm -f "$ZIP_PATH"
  echo cd "$APP_DIR"
  echo if [ ! -f "$APP_DIR/.env" ] ^&^& [ -f "$BACKUP_DIR/.env" ]; then echo "Restoring existing production .env..."; cp "$BACKUP_DIR/.env" "$APP_DIR/.env"; fi
  echo if [ -f "$APP_DIR/.env" ]; then tr -d '\r' ^< "$APP_DIR/.env" ^> "$APP_DIR/tmp/.env.lf" ^&^& mv "$APP_DIR/tmp/.env.lf" "$APP_DIR/.env"; fi
  echo echo "Fixing Prisma engine permissions..."
  echo chmod 755 "$APP_DIR"/node_modules/@prisma/engines/schema-engine-* 2^> /dev/null ^|^| true
  echo chmod 755 "$APP_DIR"/node_modules/@prisma/engines/libquery_engine-* 2^> /dev/null ^|^| true
  echo chmod 755 "$APP_DIR"/node_modules/.prisma/client/libquery_engine-* 2^> /dev/null ^|^| true
  echo ls -l "$APP_DIR"/node_modules/@prisma/engines/schema-engine-* 2^> /dev/null ^| sed -n '1,5p' ^|^| true
  echo printf "deployed_at=%%s\nzip=%ZIP_NAME%\n" "$(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ)" ^> DEPLOYED_BY_DEPLOY_PREP.txt
  echo if [ ! -f "$APP_DIR/.env" ]; then echo "WARNING: $APP_DIR/.env is missing. Hostinger panel env vars may still be used, but Prisma CLI usually needs .env."; fi
  echo export UV_THREADPOOL_SIZE=1
  echo unset PRISMA_CLIENT_ENGINE_TYPE
  echo if [ "$DB_MODE" = "migrate" ]; then
  echo   echo "Running prisma migrate deploy..."
  echo   if ! "$NODE" node_modules/prisma/build/index.js migrate deploy; then
  echo     echo "Prisma migrate failed once. Fixing generated engine permissions and retrying..."
  echo     chmod 755 "$APP_DIR"/node_modules/@prisma/engines/schema-engine-* 2^> /dev/null ^|^| true
  echo     chmod 755 "$APP_DIR"/node_modules/@prisma/engines/libquery_engine-* 2^> /dev/null ^|^| true
  echo     chmod 755 "$APP_DIR"/node_modules/.prisma/client/libquery_engine-* 2^> /dev/null ^|^| true
  echo     "$NODE" node_modules/prisma/build/index.js migrate deploy
  echo   fi
  echo fi
  echo if [ "$DB_MODE" = "dbpush" ]; then
  echo   echo "Running prisma db push..."
  echo   if ! "$NODE" node_modules/prisma/build/index.js db push; then
  echo     echo "Prisma db push failed once. Fixing generated engine permissions and retrying..."
  echo     chmod 755 "$APP_DIR"/node_modules/@prisma/engines/schema-engine-* 2^> /dev/null ^|^| true
  echo     chmod 755 "$APP_DIR"/node_modules/@prisma/engines/libquery_engine-* 2^> /dev/null ^|^| true
  echo     chmod 755 "$APP_DIR"/node_modules/.prisma/client/libquery_engine-* 2^> /dev/null ^|^| true
  echo     "$NODE" node_modules/prisma/build/index.js db push
  echo   fi
  echo fi
  echo if [ "$DB_MODE" = "skip" ]; then echo "Skipping database migration step."; fi
  echo if [ "$DO_START" = "1" ]; then
  echo   mkdir -p "$APP_DIR/tmp"
  echo   if wget -q -O /dev/null -T 5 http://127.0.0.1:3000/api/health; then
  echo     echo "App is already responding on port 3000."
  echo   else
  echo     echo "Starting app once with Node thread limits..."
  echo     nohup env UV_THREADPOOL_SIZE=1 "$NODE" --v8-pool-size=1 server.js ^> console.log 2^>^&1 ^& echo $! ^> "$APP_DIR/tmp/node.pid"
  echo     sleep 5
  echo     if ! wget -q -O /dev/null -T 10 http://127.0.0.1:3000/api/health; then
  echo       echo "App did not pass health check after start."
  echo       tail -n 120 console.log ^|^| true
  echo       exit 1
  echo     fi
  echo   fi
  echo else
  echo   echo "Skipping app start."
  echo fi
  echo echo "Final nodejs folder listing:"
  echo ls -la "$APP_DIR" ^| sed -n '1,40p'
  echo echo "Deployment complete."
)
exit /b 0

:success_prep_only
echo.
echo ========================================================
echo SUCCESS - PACKAGE ONLY
echo ========================================================
echo Zip created:
echo   %ZIP%
echo.
echo It includes standalone app contents, Prisma schema, Prisma migrations,
echo Prisma generated runtime, and the Prisma CLI needed for remote migration.
if "%INCLUDE_ENV%"=="0" echo It does not include .env, so production secrets stay remote-only.
if "%INCLUDE_ENV%"=="1" echo It includes .env generated from .env_prod.
echo ========================================================
goto :end

:success
echo.
echo ========================================================
echo SUCCESS - DEPLOYED TO HOSTINGER
echo ========================================================
echo Uploaded and extracted into:
echo   %REMOTE_APP_DIR%
echo Deploy mode:
echo   %DEPLOY_MODE%
echo Database mode:
echo   %DB_MODE%
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
  echo Close any local dev server or Node process using this project, then rerun this script.
  exit /b 1
)
exit /b 0

:fail
echo.
echo ========================================================
echo FAILED
echo ========================================================
echo Deploy was not completed.
exit /b 1

:end
if "%DO_PAUSE%"=="0" exit /b 0
pause
