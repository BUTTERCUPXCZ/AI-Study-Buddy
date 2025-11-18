import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/**
 * Example service demonstrating Redis usage
 * You can inject RedisService into any service/controller
 */
@Injectable()
export class ExampleRedisUsageService {
  constructor(private readonly redisService: RedisService) {}

  // Example: Simple key-value cache
  async cacheUserData(userId: string, userData: any) {
    // Cache for 1 hour (3600 seconds)
    await this.redisService.setCache(`user:${userId}`, userData, 3600);
  }

  async getUserFromCache(userId: string) {
    return await this.redisService.getCache(`user:${userId}`);
  }

  // Example: Rate limiting
  async checkRateLimit(userId: string, limit: number = 10): Promise<boolean> {
    const key = `rate_limit:${userId}`;
    const current = await this.redisService.incr(key);
    
    if (current === 1) {
      // Set expiration to 1 minute
      await this.redisService.expire(key, 60);
    }
    
    return current <= limit;
  }

  // Example: Session management
  async createSession(sessionId: string, userId: string, expirationSeconds: number = 86400) {
    await this.redisService.set(`session:${sessionId}`, userId, expirationSeconds);
  }

  async getSession(sessionId: string): Promise<string | null> {
    return await this.redisService.get(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string) {
    await this.redisService.del(`session:${sessionId}`);
  }

  // Example: Storing lists (e.g., user activity)
  async addUserActivity(userId: string, activity: string) {
    const key = `user:${userId}:activities`;
    await this.redisService.lpush(key, JSON.stringify({
      activity,
      timestamp: new Date().toISOString(),
    }));
    
    // Keep only last 100 activities
    // You could also implement this logic
  }

  async getUserActivities(userId: string, limit: number = 10) {
    const key = `user:${userId}:activities`;
    const activities = await this.redisService.lrange(key, 0, limit - 1);
    return activities.map(a => JSON.parse(a));
  }

  // Example: Storing sets (e.g., user tags)
  async addUserTag(userId: string, tag: string) {
    await this.redisService.sadd(`user:${userId}:tags`, tag);
  }

  async getUserTags(userId: string): Promise<string[]> {
    return await this.redisService.smembers(`user:${userId}:tags`);
  }

  async hasUserTag(userId: string, tag: string): Promise<boolean> {
    const result = await this.redisService.sismember(`user:${userId}:tags`, tag);
    return result === 1;
  }
}
