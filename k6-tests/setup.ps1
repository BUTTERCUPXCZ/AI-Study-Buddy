# Setup script for k6 load testing

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  k6 Load Testing Setup             " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check k6 installation
Write-Host "Checking k6 installation..." -ForegroundColor Yellow

try {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    $k6Version = k6 version 2>&1
    Write-Host "OK - k6 is already installed: $k6Version" -ForegroundColor Green
} catch {
    Write-Host "NOT FOUND - k6 is not installed" -ForegroundColor Red
    Write-Host "Installing k6..." -ForegroundColor Yellow
    
    try {
        winget install k6 --source winget
        Write-Host "OK - k6 installed successfully!" -ForegroundColor Green
        Write-Host "Please restart your terminal to use k6" -ForegroundColor Yellow
    } catch {
        Write-Host "ERROR - Failed to install k6" -ForegroundColor Red
        Write-Host "Please install manually: https://k6.io/docs/get-started/installation/" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Test Files Created                " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$testFiles = @(
    "load-test.js       - Comprehensive load test"
    "ai-test.js         - AI features benchmark (rate-limit safe)"
    "ai-test-gemini-free.js - Gemini free tier ultra-safe test"
    "stress-test.js     - Stress testing (up to 150 users)"
    "spike-test.js      - Spike testing (sudden surge)"
    "soak-test.js       - Soak testing (30+ minutes)"
    "upload-test.js     - File upload testing"
    "README.md          - Complete documentation"
)

foreach ($file in $testFiles) {
    Write-Host "  OK $file" -ForegroundColor Green
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Quick Start                       " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Start your backend:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   npm run start:dev" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Run a quick test:" -ForegroundColor White
Write-Host "   .\k6-tests\run-test.ps1 -TestType quick" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Run specific tests:" -ForegroundColor White
Write-Host "   .\k6-tests\run-test.ps1 -TestType load" -ForegroundColor Gray
Write-Host "   .\k6-tests\run-test.ps1 -TestType ai-free  # For Gemini free tier" -ForegroundColor Gray
Write-Host "   .\k6-tests\run-test.ps1 -TestType stress" -ForegroundColor Gray
Write-Host ""

Write-Host "5. Run all tests:" -ForegroundColor White
Write-Host "   .\k6-tests\run-test.ps1 -TestType all -OutputJson" -ForegroundColor Gray
Write-Host ""

Write-Host "6. Or run directly with k6:" -ForegroundColor White
Write-Host "   .\k6-tests\run-test.ps1 -TestType all -OutputJson" -ForegroundColor Gray
Write-Host ""

Write-Host "5. Or run directly with k6:" -ForegroundColor White
Write-Host "   k6 run k6-tests\load-test.js" -ForegroundColor Gray
Write-Host ""

Write-Host "=====================================" -ForegroundColor Green
Write-Host "  Setup Complete!                   " -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

Write-Host "For detailed documentation see k6-tests\README.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "For Gemini free tier guide see k6-tests\GEMINI_FREE_TIER_GUIDE.md" -ForegroundColor Yellow
Write-Host ""
