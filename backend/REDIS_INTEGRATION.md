# Redis Integration with Upstash

This application uses Upstash Redis for caching, session management, and other Redis operations.

## Configuration

The Redis configuration is centralized in the `src/config` folder:

- **`src/config/redis.config.ts`**: Redis-specific configuration
- **`src/config/app.config.ts`**: Application-level configuration
- **`src/config/database.config.ts`**: Database configuration
- **`src/config/index.ts`**: Exports all configurations

### Environment Variables

Make sure you have the following environment variables in your `.env` file:

```env
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

## Usage

The `RedisService` is available globally throughout your application. You can inject it into any service or controller.

### Basic Example

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis/redis.service';

@Injectable()
export class YourService {
  constructor(private readonly redisService: RedisService) {}

  async example() {
    // Set a value
    await this.redisService.set('key', 'value');

    // Get a value
    const value = await this.redisService.get('key');

    // Set with expiration (in seconds)
    await this.redisService.set('key', 'value', 3600); // expires in 1 hour

    // Cache complex objects
    await this.redisService.setCache('user:123', { id: 123, name: 'John' }, 3600);
    const user = await this.redisService.getCache('user:123');
  }
}
```

## Available Methods

### Key-Value Operations
- `get<T>(key: string)`: Get a value by key
- `set(key: string, value: any, expirationSeconds?: number)`: Set a value with optional expiration
- `del(...keys: string[])`: Delete one or more keys
- `exists(...keys: string[])`: Check if keys exist
- `expire(key: string, seconds: number)`: Set expiration on a key
- `ttl(key: string)`: Get time-to-live for a key
- `incr(key: string)`: Increment a value
- `decr(key: string)`: Decrement a value

### Cache Operations (with JSON support)
- `setCache<T>(key: string, value: T, expirationSeconds?: number)`: Cache any object
- `getCache<T>(key: string)`: Retrieve cached object

### Hash Operations
- `hget<T>(key: string, field: string)`: Get hash field
- `hset(key: string, field: string, value: any)`: Set hash field
- `hgetall<T>(key: string)`: Get all hash fields
- `hdel(key: string, ...fields: string[])`: Delete hash fields

### List Operations
- `lpush(key: string, ...elements: any[])`: Push to left of list
- `rpush(key: string, ...elements: any[])`: Push to right of list
- `lpop<T>(key: string)`: Pop from left of list
- `rpop<T>(key: string)`: Pop from right of list
- `lrange<T>(key: string, start: number, stop: number)`: Get range of list elements

### Set Operations
- `sadd(key: string, ...members: any[])`: Add members to set
- `smembers(key: string)`: Get all set members
- `sismember(key: string, member: any)`: Check if member exists in set
- `srem(key: string, ...members: any[])`: Remove members from set

### Sorted Set Operations
- `zadd(key: string, score: number, member: any)`: Add member with score
- `zrange(key: string, start: number, stop: number)`: Get range of sorted set
- `zrem(key: string, ...members: any[])`: Remove members from sorted set

## Common Use Cases

### 1. Caching API Responses

```typescript
async getCachedData(id: string) {
  const cacheKey = `api:data:${id}`;
  
  // Try to get from cache
  let data = await this.redisService.getCache(cacheKey);
  
  if (!data) {
    // If not in cache, fetch from database
    data = await this.database.findById(id);
    
    // Store in cache for 5 minutes
    await this.redisService.setCache(cacheKey, data, 300);
  }
  
  return data;
}
```

### 2. Rate Limiting

```typescript
async checkRateLimit(userId: string): Promise<boolean> {
  const key = `rate_limit:${userId}`;
  const requests = await this.redisService.incr(key);
  
  if (requests === 1) {
    // Set expiration to 1 minute for first request
    await this.redisService.expire(key, 60);
  }
  
  // Allow max 10 requests per minute
  return requests <= 10;
}
```

### 3. Session Management

```typescript
async createUserSession(userId: string) {
  const sessionId = generateSessionId();
  
  // Store session for 24 hours
  await this.redisService.set(`session:${sessionId}`, userId, 86400);
  
  return sessionId;
}

async validateSession(sessionId: string): Promise<string | null> {
  return await this.redisService.get(`session:${sessionId}`);
}
```

### 4. Real-time Leaderboard

```typescript
async updateUserScore(userId: string, score: number) {
  await this.redisService.zadd('leaderboard', score, userId);
}

async getTopUsers(limit: number = 10) {
  return await this.redisService.zrange('leaderboard', 0, limit - 1);
}
```

## Testing

You can test the Redis connection by checking the console logs when the application starts. You should see:

```
Redis client initialized successfully
```

## Error Handling

The `RedisService` includes error handling in the `onModuleInit` lifecycle hook. If Redis credentials are missing, the application will throw an error at startup.

## Direct Client Access

If you need to use Upstash Redis methods not wrapped by the service, you can access the client directly:

```typescript
const redisClient = this.redisService.getClient();
await redisClient.pipeline()
  .set('key1', 'value1')
  .set('key2', 'value2')
  .exec();
```

## Resources

- [Upstash Redis Documentation](https://upstash.com/docs/redis)
- [Upstash Redis SDK](https://github.com/upstash/upstash-redis)
