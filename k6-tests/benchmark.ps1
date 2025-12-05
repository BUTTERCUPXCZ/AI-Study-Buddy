# Quick benchmark script - runs a short test and displays key metrics

param(
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Quick Benchmark Test (30s)        " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Testing: $BaseUrl" -ForegroundColor Yellow
Write-Host ""

# Quick 30 second benchmark
$result = k6 run --vus 10 --duration 30s --env BASE_URL=$BaseUrl --summary-export=benchmark-summary.json k6-tests/load-test.js

# Parse and display key metrics if summary exists
if (Test-Path "benchmark-summary.json") {
    $summary = Get-Content "benchmark-summary.json" | ConvertFrom-Json
    
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "  Key Performance Metrics           " -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
    
    # Display key metrics
    $metrics = $summary.metrics
    
    if ($metrics.http_reqs) {
        $totalReqs = [math]::Round($metrics.http_reqs.values.count, 0)
        $reqsPerSec = [math]::Round($metrics.http_reqs.values.rate, 2)
        Write-Host "Total Requests:        $totalReqs" -ForegroundColor White
        Write-Host "Requests/Second:       $reqsPerSec req/s" -ForegroundColor White
    }
    
    if ($metrics.http_req_duration) {
        $avgDuration = [math]::Round($metrics.http_req_duration.values.avg, 2)
        $p95Duration = [math]::Round($metrics.http_req_duration.values.'p(95)', 2)
        $p99Duration = [math]::Round($metrics.http_req_duration.values.'p(99)', 2)
        
        Write-Host ""
        Write-Host "Response Times:" -ForegroundColor Cyan
        Write-Host "  Average:             $avgDuration ms" -ForegroundColor White
        Write-Host "  95th Percentile:     $p95Duration ms" -ForegroundColor White
        Write-Host "  99th Percentile:     $p99Duration ms" -ForegroundColor White
    }
    
    if ($metrics.http_req_failed) {
        $failedRate = [math]::Round($metrics.http_req_failed.values.rate * 100, 2)
        $failedCount = [math]::Round($metrics.http_req_failed.values.fails, 0)
        
        Write-Host ""
        if ($failedRate -lt 5) {
            Write-Host "Failed Requests:       $failedCount ($failedRate%)" -ForegroundColor Green
        } elseif ($failedRate -lt 10) {
            Write-Host "Failed Requests:       $failedCount ($failedRate%)" -ForegroundColor Yellow
        } else {
            Write-Host "Failed Requests:       $failedCount ($failedRate%)" -ForegroundColor Red
        }
    }
    
    if ($metrics.iterations) {
        $iterations = [math]::Round($metrics.iterations.values.count, 0)
        Write-Host "Completed Iterations:  $iterations" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    
    # Performance rating
    Write-Host ""
    Write-Host "Performance Rating:" -ForegroundColor Cyan
    
    if ($metrics.http_req_duration) {
        $p95 = $metrics.http_req_duration.values.'p(95)'
        
        if ($p95 -lt 500) {
            Write-Host "  ⭐⭐⭐⭐⭐ Excellent (p95 < 500ms)" -ForegroundColor Green
        } elseif ($p95 -lt 1000) {
            Write-Host "  ⭐⭐⭐⭐ Good (p95 < 1s)" -ForegroundColor Green
        } elseif ($p95 -lt 2000) {
            Write-Host "  ⭐⭐⭐ Acceptable (p95 < 2s)" -ForegroundColor Yellow
        } elseif ($p95 -lt 5000) {
            Write-Host "  ⭐⭐ Needs Improvement (p95 < 5s)" -ForegroundColor Yellow
        } else {
            Write-Host "  ⭐ Poor (p95 > 5s)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "Full report saved to: benchmark-summary.json" -ForegroundColor Gray
}

Write-Host ""
