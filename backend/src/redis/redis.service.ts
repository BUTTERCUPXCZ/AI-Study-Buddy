import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('redis.url');
    const token = this.configService.get<string>('redis.token');

    if (!url || !token) {
      throw new Error(
        'Redis configuration is missing. Please check your environment variables.',
      );
    }

    this.client = new Redis({
      url,
      token,
    });

    console.log('Redis client initialized successfully');
  }

  onModuleDestroy() {
    // Upstash Redis doesn't require explicit cleanup
    console.log('Redis module destroyed');
  }

  getClient(): Redis {
    return this.client;
  }

  // Common Redis operations
  async get<T = string>(key: string): Promise<T | null> {
    return await this.client.get<T>(key);
  }

  async set(
    key: string,
    value: string | number | Buffer,
    expirationSeconds?: number,
  ): Promise<string | null> {
    if (expirationSeconds) {
      return (await this.client.set(key, value, { ex: expirationSeconds })) as
        | string
        | null;
    }
    return (await this.client.set(key, value)) as string | null;
  }

  async del(...keys: string[]): Promise<number> {
    return await this.client.del(...keys);
  }

  async exists(...keys: string[]): Promise<number> {
    return await this.client.exists(...keys);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return await this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async increment(key: string): Promise<number> {
    return await this.incr(key);
  }

  async decr(key: string): Promise<number> {
    return await this.client.decr(key);
  }

  // Hash operations
  async hget<T = string>(key: string, field: string): Promise<T | null> {
    return await this.client.hget<T>(key, field);
  }

  async hset(
    key: string,
    field: string,
    value: string | number | Buffer,
  ): Promise<number> {
    return await this.client.hset(key, { [field]: value });
  }

  async hgetall<T = Record<string, unknown>>(key: string): Promise<T> {
    return (await this.client.hgetall(key)) as T;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return await this.client.hdel(key, ...fields);
  }

  // List operations
  async lpush(
    key: string,
    ...elements: (string | number | Buffer)[]
  ): Promise<number> {
    return await this.client.lpush(key, ...elements);
  }

  async rpush(
    key: string,
    ...elements: (string | number | Buffer)[]
  ): Promise<number> {
    return await this.client.rpush(key, ...elements);
  }

  async lpop<T = string>(key: string): Promise<T | null> {
    return await this.client.lpop<T>(key);
  }

  async rpop<T = string>(key: string): Promise<T | null> {
    return await this.client.rpop<T>(key);
  }

  async lrange<T = string>(
    key: string,
    start: number,
    stop: number,
  ): Promise<T[]> {
    return await this.client.lrange<T>(key, start, stop);
  }

  async ltrim(key: string, start: number, stop: number): Promise<string> {
    return await this.client.ltrim(key, start, stop);
  }

  // Set operations
  async sadd(
    key: string,
    ...members: (string | number | Buffer)[]
  ): Promise<number> {
    return await this.client.sadd(key, members[0], ...members.slice(1));
  }

  async smembers(key: string): Promise<string[]> {
    return await this.client.smembers(key);
  }

  async sismember(
    key: string,
    member: string | number | Buffer,
  ): Promise<number> {
    return await this.client.sismember(key, member);
  }

  async srem(
    key: string,
    ...members: (string | number | Buffer)[]
  ): Promise<number> {
    return await this.client.srem(key, ...members);
  }

  // Sorted Set operations
  async zadd(
    key: string,
    score: number,
    member: string | number | Buffer,
  ): Promise<number | null> {
    return await this.client.zadd(key, { score, member });
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.client.zrange(key, start, stop);
  }

  async zrem(
    key: string,
    ...members: (string | number | Buffer)[]
  ): Promise<number> {
    return await this.client.zrem(key, ...members);
  }

  // Cache with JSON support
  async setCache<T>(
    key: string,
    value: T,
    expirationSeconds?: number,
  ): Promise<string | null> {
    const serialized = JSON.stringify(value);
    return await this.set(key, serialized, expirationSeconds);
  }

  async getCache<T>(key: string): Promise<T | null> {
    const value = await this.get<string>(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
}
