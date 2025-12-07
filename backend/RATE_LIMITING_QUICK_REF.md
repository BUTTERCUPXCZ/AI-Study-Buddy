# Rate Limiting Quick Reference

## 📌 Quick Commands

```typescript
// Apply custom rate limit
@Throttle(5, 60)  // 5 requests per 60 seconds

// Skip rate limiting
@SkipThrottle()
```

## 🎯 Current Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /auth/register` | 3 | 1 minute |
| `POST /auth/login` | 5 | 1 minute |
| `POST /auth/oauth` | 5 | 1 minute |
| `POST /ai/generate/notes` | 5 | 1 minute |
| `POST /ai/generate/quiz` | 5 | 1 minute |
| `POST /ai/tutor/chat` | 20 | 1 minute |
| `POST /upload` | 10 | 1 minute |
| Other endpoints | 100 | 1 minute (default) |

## 📂 Key Files

```
backend/
├── src/
│   ├── app.module.ts                    # Configuration
│   ├── common/
│   │   ├── decorators/
│   │   │   └── throttle.decorator.ts    # @Throttle, @SkipThrottle
│   │   ├── guards/
│   │   │   └── redis-throttler.guard.ts # Custom guard
│   │   └── storage/
│   │       └── redis-throttler.storage.ts # Redis storage
│   └── redis/redis.service.ts           # Enhanced with increment()
├── RATE_LIMITING_GUIDE.md              # Full documentation
├── RATE_LIMITING_SUMMARY.md            # Implementation summary
└── RATE_LIMIT_TESTS.md                 # Test scripts
```

## 🔧 Modify Default Limits

Edit `src/app.module.ts`:

```typescript
ThrottlerModule.forRootAsync({
  useFactory: (storage: RedisThrottlerStorage) => ({
    throttlers: [
      {
        name: 'short',
        ttl: 1000,    // Change this
        limit: 10,    // Change this
      },
      // ...
    ],
    storage,
  }),
  inject: [RedisThrottlerStorage],
})
```

## 🧪 Test Rate Limiting

```powershell
# Test login endpoint (5 req/min limit)
for ($i=1; $i -le 8; $i++) {
    Invoke-WebRequest -Uri "http://localhost:3000/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body '{"email":"test@example.com","password":"test"}' `
        -SkipHttpErrorCheck
    Start-Sleep -Milliseconds 500
}
```

## 📊 Response Headers

```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 2025-12-07T12:34:56.000Z
X-RateLimit-Type: redis
```

## ❌ Rate Limit Error Response

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

## 🔍 Check Redis

```powershell
# List rate limit keys
redis-cli KEYS "rate-limit:*"

# Check specific key
redis-cli GET "rate-limit:192.168.1.1:POST-/auth/login"
redis-cli TTL "rate-limit:192.168.1.1:POST-/auth/login"
```

## 🎯 Common Use Cases

### Strict limit for expensive operations
```typescript
@Throttle(1, 60)  // 1 per minute
@Post('expensive')
async expensive() { }
```

### Relaxed limit for read operations
```typescript
@Throttle(100, 60)  // 100 per minute
@Get('data')
async getData() { }
```

### No limit for health checks
```typescript
@SkipThrottle()
@Get('health')
async health() { }
```

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Rate limit not working | Check Redis connection, verify guard is registered |
| Too strict | Increase `limit` or `ttl` in decorator |
| Not strict enough | Decrease `limit` or `ttl` |
| Redis errors | Check logs, verify Redis connection |

## 📚 Learn More

- Full guide: `RATE_LIMITING_GUIDE.md`
- Test scripts: `RATE_LIMIT_TESTS.md`
- Examples: `src/common/examples/rate-limit.controller.example.ts`
