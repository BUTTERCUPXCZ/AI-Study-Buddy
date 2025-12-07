# Rate Limiting Implementation Guide

## Overview

This application now has comprehensive rate limiting implemented using `@nestjs/throttler` with Redis storage for distributed rate limiting.

## Features

- ✅ **Redis-backed rate limiting** - Uses Redis for distributed rate limiting across multiple instances
- ✅ **Multiple rate limit tiers** - Short, medium, and long-term limits
- ✅ **Per-user tracking** - Authenticated users tracked by user ID, anonymous by IP
- ✅ **Custom decorators** - Easy-to-use `@Throttle()` and `@SkipThrottle()` decorators
- ✅ **Rate limit headers** - Responses include `X-RateLimit-*` headers
- ✅ **Graceful fallback** - If Redis fails, requests are allowed (fail-open)

## Default Rate Limits

The application has three default rate limit configurations in `app.module.ts`:

```typescript
{
  name: 'short',
  ttl: 1000,      // 1 second
  limit: 10       // 10 requests per second
},
{
  name: 'medium',
  ttl: 10000,     // 10 seconds
  limit: 50       // 50 requests per 10 seconds
},
{
  name: 'long',
  ttl: 60000,     // 1 minute
  limit: 100      // 100 requests per minute
}
```

## Endpoint-Specific Rate Limits

### Authentication Endpoints (`/auth/*`)
- **Register**: 3 requests per minute
- **Login**: 5 requests per minute
- **OAuth**: 5 requests per minute

### AI Endpoints (`/ai/*`)
- **Generate Notes**: 5 requests per minute
- **Generate Quiz**: 5 requests per minute
- **Tutor Chat**: 20 requests per minute
- **Streaming Chat**: 20 requests per minute

### Upload Endpoints (`/upload/*`)
- **Upload PDF**: 10 requests per minute
- **Other operations**: Default limits

## Usage

### Apply Custom Rate Limit

Use the `@Throttle()` decorator to set custom rate limits on any endpoint:

```typescript
import { Throttle } from '../common/decorators/throttle.decorator';

@Controller('example')
export class ExampleController {
  // 5 requests per 60 seconds
  @Throttle(5, 60)
  @Post('expensive')
  expensiveOperation() {
    return { message: 'Rate limited endpoint' };
  }
}
```

### Skip Rate Limiting

Use `@SkipThrottle()` to bypass rate limiting for specific endpoints:

```typescript
import { SkipThrottle } from '../common/decorators/throttle.decorator';

@Controller('public')
export class PublicController {
  @SkipThrottle()
  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }
}
```

### Response Headers

Rate-limited responses include these headers:

- `X-RateLimit-Limit`: Maximum number of requests allowed
- `X-RateLimit-Remaining`: Number of requests remaining
- `X-RateLimit-Reset`: ISO timestamp when the limit resets

### Error Response

When rate limit is exceeded, the API returns:

```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded. Please try again later."
}
```

## Architecture

### Components

1. **RedisThrottlerGuard** (`src/common/guards/redis-throttler.guard.ts`)
   - Extends NestJS `ThrottlerGuard`
   - Uses Redis for distributed rate limiting
   - Tracks by user ID (authenticated) or IP address (anonymous)
   - Adds rate limit headers to responses

2. **Throttle Decorators** (`src/common/decorators/throttle.decorator.ts`)
   - `@Throttle(limit, ttl)` - Apply custom rate limit
   - `@SkipThrottle()` - Skip rate limiting

3. **Redis Service** (`src/redis/redis.service.ts`)
   - Enhanced with `increment()` method for atomic counter operations
   - Handles Redis connection and operations

### How It Works

1. **Request arrives** → Guard intercepts the request
2. **Get tracker** → Extract user ID (if authenticated) or IP address
3. **Generate key** → Create Redis key: `rate-limit:{tracker}:{context}`
4. **Increment counter** → Atomically increment request count in Redis
5. **Check limit** → Compare count against the limit
6. **Allow or block** → Return response or throw `ThrottlerException`

## Redis Keys

Rate limit counters are stored in Redis with this pattern:

```
rate-limit:{tracker}:{route-context}
```

Examples:
- `rate-limit:user-123:POST-/ai/generate/notes`
- `rate-limit:192.168.1.1:POST-/auth/login`

Keys automatically expire based on the TTL configured.

## Configuration

### Modify Default Limits

Edit `src/app.module.ts`:

```typescript
ThrottlerModule.forRoot([
  {
    name: 'short',
    ttl: 1000,
    limit: 20, // Increase to 20 requests per second
  },
  // ... other configurations
])
```

### Add New Rate Limit Tier

```typescript
ThrottlerModule.forRoot([
  // ... existing configurations
  {
    name: 'ultra-strict',
    ttl: 3600000, // 1 hour
    limit: 10,    // 10 requests per hour
  },
])
```

## Best Practices

1. **Expensive Operations**: Use stricter limits (e.g., AI generation, file uploads)
2. **Authentication**: Very strict limits to prevent brute force attacks
3. **Read Operations**: More relaxed limits
4. **Public Endpoints**: Consider skipping rate limiting for health checks

## Monitoring

Monitor rate limiting in your logs:

```typescript
// Redis throttler errors are logged
console.error('Redis throttler error:', error);
```

Consider adding metrics:
- Track rate limit hits
- Monitor Redis performance
- Alert on frequent rate limit violations

## Testing

Test rate limiting with curl:

```bash
# Make multiple requests
for i in {1..15}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123"}' \
    -w "\nStatus: %{http_code}\n"
done
```

You should see:
- First 5 requests: `200 OK`
- Subsequent requests: `429 Too Many Requests`

## Troubleshooting

### Rate Limiting Not Working

1. Verify Redis is connected:
   ```bash
   curl http://localhost:3000/redis-test/ping
   ```

2. Check Redis keys:
   ```bash
   # In your Redis client
   KEYS rate-limit:*
   ```

3. Verify guard is registered in `app.module.ts`

### Rate Limits Too Strict/Lenient

Adjust the `@Throttle()` decorator parameters or modify the default configuration in `app.module.ts`.

### Redis Connection Issues

The guard fails open (allows requests) if Redis is unavailable to prevent service disruption. Check Redis logs and connection settings.

## Future Enhancements

- [ ] Add per-user rate limit customization (premium users get higher limits)
- [ ] Implement burst allowance
- [ ] Add metrics dashboard
- [ ] Implement different limits for different user roles
- [ ] Add rate limit bypass for trusted IPs
- [ ] Implement sliding window algorithm

## Related Files

- `src/app.module.ts` - Rate limiting configuration
- `src/common/guards/redis-throttler.guard.ts` - Custom guard implementation
- `src/common/decorators/throttle.decorator.ts` - Throttle decorators
- `src/redis/redis.service.ts` - Redis service with increment support
- `src/auth/auth.controller.ts` - Auth endpoints with rate limiting
- `src/ai/ai.controller.ts` - AI endpoints with rate limiting
- `src/uploads/pdf.controller.ts` - Upload endpoints with rate limiting
