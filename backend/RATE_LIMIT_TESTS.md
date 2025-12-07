# Rate Limiting Test Script

This script tests the rate limiting implementation.

## Prerequisites
- Backend server running on http://localhost:3000
- PowerShell

## Test Rate Limiting

### Test 1: Auth Login Rate Limit (5 per minute)

```powershell
# Should allow first 5, then block
for ($i=1; $i -le 8; $i++) {
    Write-Host "Request $i"
    $response = Invoke-WebRequest -Uri "http://localhost:3000/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body '{"email":"test@example.com","password":"test123"}' `
        -SkipHttpErrorCheck
    
    Write-Host "Status: $($response.StatusCode)"
    if ($response.Headers['X-RateLimit-Limit']) {
        Write-Host "Limit: $($response.Headers['X-RateLimit-Limit'])"
        Write-Host "Remaining: $($response.Headers['X-RateLimit-Remaining'])"
    }
    Write-Host "---"
    Start-Sleep -Milliseconds 500
}
```

### Test 2: AI Generation Rate Limit (5 per minute)

```powershell
# Test AI note generation
for ($i=1; $i -le 7; $i++) {
    Write-Host "Request $i"
    $response = Invoke-WebRequest -Uri "http://localhost:3000/ai/generate/notes" `
        -Method POST `
        -ContentType "application/json" `
        -Body '{"pdfText":"test","userId":"user123","title":"Test","source":"test.pdf"}' `
        -SkipHttpErrorCheck
    
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "---"
    Start-Sleep -Milliseconds 500
}
```

### Test 3: File Upload Rate Limit (10 per minute)

```powershell
# Test file upload endpoint
for ($i=1; $i -le 12; $i++) {
    Write-Host "Request $i"
    $response = Invoke-WebRequest -Uri "http://localhost:3000/upload" `
        -Method POST `
        -SkipHttpErrorCheck
    
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "---"
    Start-Sleep -Milliseconds 500
}
```

### Test 4: Default Rate Limit

```powershell
# Test health endpoint with default limits
for ($i=1; $i -le 15; $i++) {
    Write-Host "Request $i"
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" `
        -Method GET `
        -SkipHttpErrorCheck
    
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "---"
    Start-Sleep -Milliseconds 100
}
```

## Expected Results

1. **Login Endpoint**: First 5 requests should succeed (200), next requests should be rate limited (429)
2. **AI Generation**: First 5 requests succeed, subsequent fail with 429
3. **Upload**: First 10 requests succeed, subsequent fail with 429
4. **Health**: Uses default rate limits from app.module.ts

## Verify in Redis

Check Redis keys:

```powershell
# If you have redis-cli, you can check the keys
redis-cli KEYS "rate-limit:*"
```

Or use the Redis test endpoint:

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/redis-test/ping" -Method GET
```

## Notes

- Rate limits are per IP address for unauthenticated requests
- Rate limits are per user ID for authenticated requests
- Limits reset after the TTL expires
- Response includes headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
