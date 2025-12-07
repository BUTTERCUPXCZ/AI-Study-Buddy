import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from '../../redis/redis.service';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _limit: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _blockDuration: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `rate-limit:${key}`;

    try {
      // Increment the counter
      const totalHits = await this.redisService.increment(redisKey);

      // Get TTL from Redis
      let timeToExpire = await this.redisService.ttl(redisKey);

      // Set expiry on first request
      if (totalHits === 1 || timeToExpire === -1) {
        await this.redisService.expire(redisKey, Math.ceil(ttl / 1000)); // Convert ms to seconds
        timeToExpire = Math.ceil(ttl / 1000);
      }

      return {
        totalHits,
        timeToExpire: timeToExpire > 0 ? timeToExpire : Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch (error) {
      console.error('Redis throttler error:', error);
      // Fallback to allow request if Redis fails
      return {
        totalHits: 0,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  // Required by interface but not used with Redis
  storage = new Map();
}
