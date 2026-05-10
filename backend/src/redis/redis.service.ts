import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { type Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('redis.url');
    const host = this.configService.get<string>('redis.host');
    const port = this.configService.get<number>('redis.port') || 6379;
    const password = this.configService.get<string>('redis.password');
    const tls = this.configService.get<boolean>('redis.tls');

    if (url) {
      this.client = new IORedis(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: false,
        retryStrategy: (times) => Math.min(times * 200, 5000),
      });
    } else if (host) {
      this.client = new IORedis({
        host,
        port,
        password,
        tls: tls ? {} : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: false,
        retryStrategy: (times) => Math.min(times * 200, 5000),
      });
    } else {
      throw new Error(
        'Redis configuration missing — set REDIS_URL or REDIS_HOST/REDIS_PORT/REDIS_PASSWORD.',
      );
    }

    this.client.on('error', (err: Error) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
    this.client.on('connect', () => this.logger.log('Redis TCP connected'));
    this.client.on('ready', () => this.logger.log('Redis ready'));

    this.logger.log('Redis client initialized (ioredis TCP)');
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
    this.logger.log('Redis disconnected');
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<boolean> {
    try {
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Execute a Lua script atomically against Redis. Used by the throttler to
   * make INCR + EXPIRE + TTL one round-trip with no race window.
   */
  async runScript<T = unknown>(
    script: string,
    keys: string[],
    args: (string | number)[],
  ): Promise<T> {
    const result: unknown = await this.client.eval(
      script,
      keys.length,
      ...keys,
      ...args,
    );
    return result as T;
  }

  // --- String / generic ops ----------------------------------------------

  async get<T = string>(key: string): Promise<T | null> {
    const v = await this.client.get(key);
    return v as T | null;
  }

  async set(
    key: string,
    value: string | number | Buffer,
    expirationSeconds?: number,
  ): Promise<string | null> {
    const v: string | number | Buffer =
      typeof value === 'number' ? String(value) : value;
    if (expirationSeconds) {
      return await this.client.set(key, v, 'EX', expirationSeconds);
    }
    return await this.client.set(key, v);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
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

  // --- Hash ops ----------------------------------------------------------

  async hget<T = string>(key: string, field: string): Promise<T | null> {
    const v = await this.client.hget(key, field);
    return v as T | null;
  }

  async hset(
    key: string,
    field: string,
    value: string | number | Buffer,
  ): Promise<number> {
    const v: string | number | Buffer =
      typeof value === 'number' ? String(value) : value;
    return await this.client.hset(key, field, v);
  }

  async hgetall<T = Record<string, string>>(key: string): Promise<T> {
    return (await this.client.hgetall(key)) as T;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    if (fields.length === 0) return 0;
    return await this.client.hdel(key, ...fields);
  }

  // --- List ops ----------------------------------------------------------

  async lpush(
    key: string,
    ...elements: (string | number | Buffer)[]
  ): Promise<number> {
    return await this.client.lpush(key, ...this.coerceArr(elements));
  }

  async rpush(
    key: string,
    ...elements: (string | number | Buffer)[]
  ): Promise<number> {
    return await this.client.rpush(key, ...this.coerceArr(elements));
  }

  async lpop<T = string>(key: string): Promise<T | null> {
    const v = await this.client.lpop(key);
    return v as T | null;
  }

  async rpop<T = string>(key: string): Promise<T | null> {
    const v = await this.client.rpop(key);
    return v as T | null;
  }

  async lrange<T = string>(
    key: string,
    start: number,
    stop: number,
  ): Promise<T[]> {
    return (await this.client.lrange(key, start, stop)) as T[];
  }

  async ltrim(key: string, start: number, stop: number): Promise<string> {
    return await this.client.ltrim(key, start, stop);
  }

  // --- Set ops -----------------------------------------------------------

  async sadd(
    key: string,
    ...members: (string | number | Buffer)[]
  ): Promise<number> {
    return await this.client.sadd(key, ...this.coerceArr(members));
  }

  async smembers(key: string): Promise<string[]> {
    return await this.client.smembers(key);
  }

  async sismember(
    key: string,
    member: string | number | Buffer,
  ): Promise<number> {
    return await this.client.sismember(key, this.coerce(member));
  }

  async srem(
    key: string,
    ...members: (string | number | Buffer)[]
  ): Promise<number> {
    if (members.length === 0) return 0;
    return await this.client.srem(key, ...this.coerceArr(members));
  }

  // --- Sorted set ops ----------------------------------------------------

  async zadd(
    key: string,
    score: number,
    member: string | number | Buffer,
  ): Promise<number | null> {
    const v = await this.client.zadd(key, score, this.coerce(member));
    return typeof v === 'string' ? Number(v) : v;
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.client.zrange(key, start, stop);
  }

  async zrem(
    key: string,
    ...members: (string | number | Buffer)[]
  ): Promise<number> {
    if (members.length === 0) return 0;
    return await this.client.zrem(key, ...this.coerceArr(members));
  }

  // --- JSON cache helpers -------------------------------------------------

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
      return value as unknown as T;
    }
  }

  // ioredis accepts string|Buffer|number, but its overloads bias toward
  // string|Buffer for variadic args. Coerce numbers to strings to keep TS
  // happy without changing on-wire semantics — Redis stores them as strings
  // anyway.
  private coerce(v: string | number | Buffer): string | Buffer {
    return typeof v === 'number' ? String(v) : v;
  }

  private coerceArr(arr: (string | number | Buffer)[]): (string | Buffer)[] {
    return arr.map((v) => this.coerce(v));
  }
}
