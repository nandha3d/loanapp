param([switch]$SkipDownload)

Write-Host "=== LoanTrack Mobile - Windows Setup ===" -ForegroundColor Cyan
Write-Host ""

$flutterPath = "C:\flutter"
$flutterBinPath = "$flutterPath\bin"

if ((Test-Path $flutterPath) -and (Test-Path "$flutterBinPath\flutter.bat")) {
    Write-Host "[1/5] Flutter is already installed" -ForegroundColor Green
} else {
    Write-Host "[1/5] Installing Flutter SDK..." -ForegroundColor Yellow
    Write-Host "Downloading Flutter..." -ForegroundColor Cyan
    
    if ($SkipDownload) {
        Write-Host "Skipping download as requested" -ForegroundColor Yellow
    } else {
        $zipPath = "$env:TEMP\flutter.zip"
        $url = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.24.0-stable.zip"
        
        try {
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -Uri $url -OutFile $zipPath -TimeoutSec 300
            
            Write-Host "Extracting Flutter..." -ForegroundColor Cyan
            if (Test-Path $flutterPath) { Remove-Item $flutterPath -Recurse -Force }
            Expand-Archive -Path $zipPath -DestinationPath "C:\" -Force
            Remove-Item $zipPath -Force
            Write-Host "[OK] Flutter installed" -ForegroundColor Green
        } catch {
            Write-Host "[ERROR] Failed to download: $_" -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host ""
Write-Host "[2/5] Updating PATH..." -ForegroundColor Yellow
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -notlike "*$flutterBinPath*") {
    [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$flutterBinPath", "User")
    $env:PATH = "$env:PATH;$flutterBinPath"
    Write-Host "[OK] PATH updated" -ForegroundColor Green
} else {
    Write-Host "[OK] Flutter already in PATH" -ForegroundColor Green
}

Write-Host ""
Write-Host "[3/5] Running flutter doctor..." -ForegroundColor Yellow
& "$flutterBinPath\flutter.bat" doctor

Write-Host ""
Write-Host "[4/5] Installing dependencies..." -ForegroundColor Yellow
Set-Location (Get-Item $PSScriptRoot).FullName
& "$flutterBinPath\flutter.bat" pub get
Write-Host "[OK] Dependencies installed" -ForegroundColor Green

Write-Host ""
Write-Host "[5/5] Generating Windows files..." -ForegroundColor Yellow
& "$flutterBinPath\flutter.bat" create . --project-name loantrack --org com.loantrack --platforms=windows
Write-Host "[OK] Setup complete" -ForegroundColor Green

Write-Host ""
Write-Host "=== READY TO RUN ===" -ForegroundColor Green
Write-Host "1. Start backend: npm run dev (from repo root)"
Write-Host "2. Run app: flutter run -d windows"
