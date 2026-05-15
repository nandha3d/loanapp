@echo off
SETLOCAL EnableDelayedExpansion

echo [1/6] Cleaning up old build artifacts...
if exist ".next" rmdir /s /q ".next"
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache"

echo [2/6] Generating Prisma Client...
call npx prisma generate

echo [3/6] Building Next.js application (Standalone mode)...
call npm run build

echo [4/6] Assembling Standalone folder...
echo   - Injecting Public assets...
xcopy /s /e /y /i "public" ".next\standalone\loanapp\public"

echo   - Injecting Static assets...
xcopy /s /e /y /i ".next\static" ".next\standalone\loanapp\.next\static"

echo [5/6] Fixing Prisma Module Mangling...
echo   - Removing broken/symlinked Prisma folders in standalone...
if exist ".next\standalone\loanapp\node_modules\.prisma" rmdir /s /q ".next\standalone\loanapp\node_modules\.prisma"
if exist ".next\standalone\loanapp\node_modules\@prisma" rmdir /s /q ".next\standalone\loanapp\node_modules\@prisma"

echo   - Injecting physical Prisma folders...
xcopy /s /e /y /i "node_modules\.prisma" ".next\standalone\loanapp\node_modules\.prisma"
xcopy /s /e /y /i "node_modules\@prisma" ".next\standalone\loanapp\node_modules\@prisma"

echo [6/6] Finalizing link-free package...
echo Build complete. The production-ready files are in: .next\standalone\loanapp
echo --------------------------------------------------------
echo NEXT STEP: 
echo 1. Zip the CONTENTS of the ".next\standalone\loanapp" folder.
echo 2. Upload the zip to Hostinger.
echo 3. Run "node server.js" on the server.
echo --------------------------------------------------------
pause
