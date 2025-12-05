# k6 Test Runner Script for AI Study Buddy
# This script helps you run different test scenarios easily

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("load", "ai", "ai-free", "stress", "spike", "soak", "upload", "all", "quick")]
    [string]$TestType = "load",
    
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:3000",
    
    [Parameter(Mandatory=$false)]
    [switch]$OutputJson
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  AI Study Buddy - k6 Load Testing  " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if k6 is installed
try {
    $k6Version = k6 version 2>&1
    Write-Host "✓ k6 is installed: $k6Version" -ForegroundColor Green
} catch {
    Write-Host "✗ k6 is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please run: winget install k6 --source winget" -ForegroundColor Yellow
    exit 1
}

# Check if backend is running
Write-Host "Checking if backend is running on $BaseUrl..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/auth/me" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "✓ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "⚠ Warning: Could not connect to backend at $BaseUrl" -ForegroundColor Yellow
    Write-Host "  Make sure your backend is running before tests execute" -ForegroundColor Yellow
}

Write-Host ""

# Prepare output options
$outputOptions = ""
if ($OutputJson) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $outputOptions = "--out json=k6-results-$TestType-$timestamp.json"
    Write-Host "Results will be saved to: k6-results-$TestType-$timestamp.json" -ForegroundColor Cyan
}

# Run tests based on type
switch ($TestType) {
    "load" {
        Write-Host "Running LOAD TEST..." -ForegroundColor Green
        Write-Host "This will test normal user workflows with 10-20 concurrent users" -ForegroundColor Gray
        Write-Host ""
        k6 run --env BASE_URL=$BaseUrl $outputOptions k6-tests/load-test.js
    }
    
    "ai" {
        Write-Host "Running AI FEATURES TEST..." -ForegroundColor Green
        Write-Host "This will test AI generation features (1 user, rate-limit safe)" -ForegroundColor Gray
        Write-Host "⚠ Note: Configured for Gemini free tier with delays" -ForegroundColor Yellow
        Write-Host ""
        k6 run --env BASE_URL=$BaseUrl $outputOptions k6-tests/ai-test.js
    }
    
    "ai-free" {
        Write-Host "Running GEMINI FREE TIER SAFE TEST..." -ForegroundColor Green
        Write-Host "Ultra-safe test: 1 request at a time, 60s delays" -ForegroundColor Gray
        Write-Host "⚠ This test will take ~3-4 minutes" -ForegroundColor Yellow
        Write-Host "✓ Safe for Gemini free tier (only 3 AI requests total)" -ForegroundColor Green
        Write-Host ""
        k6 run --env BASE_URL=$BaseUrl $outputOptions k6-tests/ai-test-gemini-free.js
    }
    
    "stress" {
        Write-Host "Running STRESS TEST..." -ForegroundColor Green
        Write-Host "This will gradually increase load to 150 users to find limits" -ForegroundColor Gray
        Write-Host "Expected duration: ~12 minutes" -ForegroundColor Yellow
        Write-Host ""
        k6 run --env BASE_URL=$BaseUrl $outputOptions k6-tests/stress-test.js
    }
    
    "spike" {
        Write-Host "Running SPIKE TEST..." -ForegroundColor Green
        Write-Host "This will simulate sudden traffic spike to 200 users" -ForegroundColor Gray
        Write-Host ""
        k6 run --env BASE_URL=$BaseUrl $outputOptions k6-tests/spike-test.js
    }
    
    "soak" {
        Write-Host "Running SOAK TEST..." -ForegroundColor Green
        Write-Host "This will run 20 users for 30+ minutes to detect memory leaks" -ForegroundColor Gray
        Write-Host "⚠ Warning: This test takes 40+ minutes!" -ForegroundColor Yellow
        $continue = Read-Host "Continue? (y/n)"
        if ($continue -ne "y") {
            Write-Host "Test cancelled" -ForegroundColor Yellow
            exit 0
        }
        Write-Host ""
        k6 run --env BASE_URL=$BaseUrl $outputOptions k6-tests/soak-test.js
    }
    
    "upload" {
        Write-Host "Running FILE UPLOAD TEST..." -ForegroundColor Green
        Write-Host "This will test PDF file upload functionality" -ForegroundColor Gray
        Write-Host ""
        k6 run --env BASE_URL=$BaseUrl $outputOptions k6-tests/upload-test.js
    }
    
    "quick" {
        Write-Host "Running QUICK SMOKE TEST..." -ForegroundColor Green
        Write-Host "Quick validation with 5 users for 30 seconds" -ForegroundColor Gray
        Write-Host ""
        k6 run --vus 5 --duration 30s --env BASE_URL=$BaseUrl k6-tests/load-test.js
    }
    
    "all" {
        Write-Host "Running ALL TESTS (except soak)..." -ForegroundColor Green
        Write-Host "⚠ Using Gemini-safe AI test to avoid rate limits" -ForegroundColor Yellow
        Write-Host "This will take approximately 30-40 minutes" -ForegroundColor Yellow
        Write-Host ""
        
        $tests = @("load", "upload", "ai-free", "stress", "spike")
        
        foreach ($test in $tests) {
            Write-Host ""
            Write-Host "======================================" -ForegroundColor Cyan
            Write-Host "  Starting: $test test" -ForegroundColor Cyan
            Write-Host "======================================" -ForegroundColor Cyan
            
            $testFile = if ($test -eq "ai-free") { "ai-test-gemini-free" } else { "$test-test" }
            
            if ($OutputJson) {
                $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
                k6 run --env BASE_URL=$BaseUrl --out json=k6-results-$test-$timestamp.json k6-tests/$testFile.js
            } else {
                k6 run --env BASE_URL=$BaseUrl k6-tests/$testFile.js
            }
            
            Write-Host ""
            Write-Host "✓ Completed: $test test" -ForegroundColor Green
            Write-Host ""
            Start-Sleep -Seconds 10
        }
        
        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host "  All tests completed!" -ForegroundColor Green
        Write-Host "=====================================" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Test execution completed!" -ForegroundColor Green
Write-Host ""
