import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { RedisService } from './redis.service';

@Controller('redis-test')
export class RedisTestController {
  constructor(private readonly redisService: RedisService) {}

  @Post('set')
  async setValue(@Body() body: { key: string; value: any; ttl?: number }) {
    await this.redisService.setCache(body.key, body.value, body.ttl);
    return { message: 'Value set successfully', key: body.key };
  }

  @Get('get/:key')
  async getValue(@Param('key') key: string) {
    const value = await this.redisService.getCache(key);
    return { key, value };
  }

  @Delete('delete/:key')
  async deleteValue(@Param('key') key: string) {
    await this.redisService.del(key);
    return { message: 'Value deleted successfully', key };
  }

  @Get('test-connection')
  async testConnection() {
    const testKey = 'test:connection';
    const testValue = { timestamp: new Date().toISOString(), message: 'Redis is working!' };
    
    // Set a test value
    await this.redisService.setCache(testKey, testValue, 60);
    
    // Get it back
    const retrieved = await this.redisService.getCache(testKey);
    
    return {
      success: true,
      message: 'Redis connection is working!',
      testData: retrieved,
    };
  }

  @Post('rate-limit/:userId')
  async testRateLimit(@Param('userId') userId: string) {
    const key = `rate_limit:${userId}`;
    const count = await this.redisService.incr(key);
    
    if (count === 1) {
      // Set expiration to 1 minute
      await this.redisService.expire(key, 60);
    }
    
    const ttl = await this.redisService.ttl(key);
    const allowed = count <= 10;
    
    return {
      userId,
      requestCount: count,
      allowed,
      resetsIn: ttl,
      message: allowed ? 'Request allowed' : 'Rate limit exceeded',
    };
  }
}
