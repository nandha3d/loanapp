# Zip Project Script for Windows (PowerShell)
# This script zips the current folder while excluding non-required files.

$projectName = (Get-Item .).Name
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$zipFileName = "${projectName}_source_${timestamp}.zip"

# Define patterns to exclude
# Define patterns to exclude
$excludePatterns = @(
    "*\.git*",
    "*\.github*",
    "*\node_modules*",
    "*\.next*",
    "*\*.zip",
    "*\*.pdf",
    "*\*.sql",
    "*\.env*",
    "*package-lock.json",
    "*tsconfig.tsbuildinfo",
    "*\scratch*",
    "*\*.md*"
)

Write-Host "Creating zip: $zipFileName" -ForegroundColor Cyan
Write-Host "Excluding: $excludePatterns" -ForegroundColor Yellow

# Load the compression assembly
Add-Type -AssemblyName "System.IO.Compression"
Add-Type -AssemblyName "System.IO.Compression.FileSystem"

# Get all files excluding the patterns
$rootPath = (Get-Item .).FullName
$files = Get-ChildItem -LiteralPath . -Recurse | Where-Object {
    if ($_.PSIsContainer) { return $false }
    $itemPath = $_.FullName
    $exclude = $false
    foreach ($pattern in $excludePatterns) {
        if ($itemPath -like $pattern) {
            $exclude = $true
            break
        }
    }
    !$exclude
}

Write-Host "Compressing $($files.Count) files..." -ForegroundColor Gray

# Create the zip file
$zipFileStream = New-Object System.IO.FileStream($zipFileName, [System.IO.FileMode]::Create)
$zipArchive = New-Object System.IO.Compression.ZipArchive($zipFileStream, [System.IO.Compression.ZipArchiveMode]::Create)

try {
    foreach ($file in $files) {
        try {
            # Calculate relative path and force forward slashes
            $relativePath = $file.FullName.Substring($rootPath.Length).TrimStart("\")
            $zipEntryName = $relativePath.Replace("\", "/")
            
            # Use FileShare.ReadWrite to allow reading files opened by other apps (like Word)
            $fileStream = [System.IO.File]::Open($file.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
            
            try {
                # Create entry and copy content
                $entry = $zipArchive.CreateEntry($zipEntryName, [System.IO.Compression.CompressionLevel]::Optimal)
                $entryStream = $entry.Open()
                try {
                    $fileStream.CopyTo($entryStream)
                }
                finally {
                    $entryStream.Close()
                }
            }
            finally {
                $fileStream.Close()
            }
        }
        catch {
            Write-Host "Warning: Could not add $($file.Name) - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}
finally {
    $zipArchive.Dispose()
    $zipFileStream.Dispose()
}

Write-Host "Successfully created $zipFileName with forward slashes." -ForegroundColor Green
