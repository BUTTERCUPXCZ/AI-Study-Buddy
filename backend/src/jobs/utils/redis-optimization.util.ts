import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis Optimization Utilities
 * 
 * Provides optimized Redis operations with pipelining, batching, and caching strategies
 * to reduce round trips and improve performance.
 */
export class RedisOptimizationUtil {
  private static readonly logger = new Logger('RedisOptimizationUtil');

  /**
   * Batch get multiple keys in a single pipeline
   * Much faster than individual GET operations
   */
  static async batchGet(
    redis: Redis,
    keys: string[],
  ): Promise<Map<string, string | null>> {
    if (keys.length === 0) return new Map();

    const pipeline = redis.pipeline();
    keys.forEach(key => pipeline.get(key));

    const results = await pipeline.exec();
    const resultMap = new Map<string, string | null>();

    results?.forEach((result, index) => {
      const [error, value] = result;
      if (!error) {
        resultMap.set(keys[index], value as string | null);
      }
    });

    return resultMap;
  }

  /**
   * Batch set multiple keys in a single pipeline
   */
  static async batchSet(
    redis: Redis,
    entries: Array<{ key: string; value: string; ttl?: number }>,
  ): Promise<void> {
    if (entries.length === 0) return;

    const pipeline = redis.pipeline();

    entries.forEach(({ key, value, ttl }) => {
      if (ttl) {
        pipeline.setex(key, ttl, value);
      } else {
        pipeline.set(key, value);
      }
    });

    await pipeline.exec();
  }

  /**
   * Batch delete multiple keys efficiently
   */
  static async batchDelete(redis: Redis, keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;

    // Use DEL with multiple keys (more efficient than pipeline for deletes)
    if (keys.length <= 100) {
      return await redis.del(...keys);
    }

    // For large batches, chunk them
    let totalDeleted = 0;
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100);
      totalDeleted += await redis.del(...chunk);
    }

    return totalDeleted;
  }

  /**
   * Multi-level cache with L1 (memory) and L2 (Redis)
   */
  static createMultiLevelCache<T>(options: {
    redis: Redis;
    l1MaxSize?: number;
    l1Ttl?: number;
    l2Ttl?: number;
  }) {
    const { redis, l1MaxSize = 100, l1Ttl = 60000, l2Ttl = 3600 } = options;

    // L1 cache (in-memory)
    const l1Cache = new Map<string, { value: T; expiry: number }>();

    return {
      /**
       * Get value from multi-level cache
       */
      async get(key: string): Promise<T | null> {
        // Check L1 cache first
        const l1Entry = l1Cache.get(key);
        if (l1Entry && l1Entry.expiry > Date.now()) {
          return l1Entry.value;
        }

        // Check L2 (Redis) cache
        const l2Value = await redis.get(key);
        if (l2Value) {
          const parsed = JSON.parse(l2Value) as T;

          // Populate L1 cache
          if (l1Cache.size < l1MaxSize) {
            l1Cache.set(key, {
              value: parsed,
              expiry: Date.now() + l1Ttl,
            });
          }

          return parsed;
        }

        return null;
      },

      /**
       * Set value in both cache levels
       */
      async set(key: string, value: T): Promise<void> {
        // Set in L1
        if (l1Cache.size >= l1MaxSize) {
          // Evict oldest entry
          const firstKey = l1Cache.keys().next().value;
          l1Cache.delete(firstKey);
        }

        l1Cache.set(key, {
          value,
          expiry: Date.now() + l1Ttl,
        });

        // Set in L2
        await redis.setex(key, l2Ttl, JSON.stringify(value));
      },

      /**
       * Invalidate cache entry
       */
      async invalidate(key: string): Promise<void> {
        l1Cache.delete(key);
        await redis.del(key);
      },

      /**
       * Clear all cache entries
       */
      clear(): void {
        l1Cache.clear();
      },

      /**
       * Get cache statistics
       */
      getStats() {
        return {
          l1Size: l1Cache.size,
          l1MaxSize,
          l1HitRate: 0, // TODO: track hits/misses
        };
      },
    };
  }

  /**
   * Optimized Redis pub/sub with message batching
   */
  static createBatchedPublisher(redis: Redis, batchSize: number = 10, batchDelay: number = 100) {
    const messageQueue: Array<{ channel: string; message: string }> = [];
    let flushTimer: NodeJS.Timeout | null = null;

    const flush = async () => {
      if (messageQueue.length === 0) return;

      const batch = messageQueue.splice(0, messageQueue.length);
      const pipeline = redis.pipeline();

      batch.forEach(({ channel, message }) => {
        pipeline.publish(channel, message);
      });

      await pipeline.exec();
    };

    return {
      /**
       * Publish message (batched)
       */
      publish(channel: string, message: string): void {
        messageQueue.push({ channel, message });

        if (messageQueue.length >= batchSize) {
          // Flush immediately if batch is full
          if (flushTimer) clearTimeout(flushTimer);
          flush();
        } else if (!flushTimer) {
          // Schedule flush
          flushTimer = setTimeout(() => {
            flushTimer = null;
            flush();
          }, batchDelay);
        }
      },

      /**
       * Force flush pending messages
       */
      async flush(): Promise<void> {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        await flush();
      },
    };
  }

  /**
   * Implement read-through cache pattern
   */
  static createReadThroughCache<T>(options: {
    redis: Redis;
    ttl: number;
    keyPrefix: string;
    loader: (id: string) => Promise<T>;
  }) {
    const { redis, ttl, keyPrefix, loader } = options;

    return {
      /**
       * Get value with automatic loading
       */
      async get(id: string): Promise<T> {
        const key = `${keyPrefix}:${id}`;
        const cached = await redis.get(key);

        if (cached) {
          return JSON.parse(cached) as T;
        }

        // Load from source
        const value = await loader(id);

        // Cache it
        await redis.setex(key, ttl, JSON.stringify(value));

        return value;
      },

      /**
       * Batch load multiple IDs
       */
      async batchGet(ids: string[]): Promise<Map<string, T>> {
        const keys = ids.map(id => `${keyPrefix}:${id}`);
        const cached = await this.batchGet(redis, keys);

        const results = new Map<string, T>();
        const missingIds: string[] = [];

        ids.forEach((id, index) => {
          const cachedValue = cached.get(keys[index]);
          if (cachedValue) {
            results.set(id, JSON.parse(cachedValue) as T);
          } else {
            missingIds.push(id);
          }
        });

        // Load missing values
        if (missingIds.length > 0) {
          const loadPromises = missingIds.map(async id => {
            const value = await loader(id);
            results.set(id, value);
            // Cache it
            await redis.setex(`${keyPrefix}:${id}`, ttl, JSON.stringify(value));
          });

          await Promise.all(loadPromises);
        }

        return results;
      },

      /**
       * Invalidate cache entry
       */
      async invalidate(id: string): Promise<void> {
        await redis.del(`${keyPrefix}:${id}`);
      },
    };
  }

  /**
   * Implement cache-aside pattern with lock to prevent stampede
   */
  static async cacheAside<T>(
    redis: Redis,
    key: string,
    ttl: number,
    loader: () => Promise<T>,
    lockTimeout: number = 10000,
  ): Promise<T> {
    // Try to get from cache
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    // Acquire lock to prevent multiple loads
    const lockKey = `lock:${key}`;
    const lockAcquired = await redis.set(lockKey, '1', 'PX', lockTimeout, 'NX');

    if (lockAcquired) {
      try {
        // Double-check cache (another process might have loaded it)
        const recheck = await redis.get(key);
        if (recheck) {
          return JSON.parse(recheck) as T;
        }

        // Load value
        const value = await loader();

        // Cache it
        await redis.setex(key, ttl, JSON.stringify(value));

        return value;
      } finally {
        // Release lock
        await redis.del(lockKey);
      }
    } else {
      // Wait for lock holder to finish
      await new Promise(resolve => setTimeout(resolve, 100));

      // Retry getting from cache
      const retryCache = await redis.get(key);
      if (retryCache) {
        return JSON.parse(retryCache) as T;
      }

      // If still not cached, load directly (fallback)
      return await loader();
    }
  }

  /**
   * Optimize Lua script execution with result caching
   */
  static async executeCachedScript(
    redis: Redis,
    script: string,
    keys: string[],
    args: string[],
  ): Promise<any> {
    // Use EVALSHA to avoid sending script every time
    const sha = require('crypto')
      .createHash('sha1')
      .update(script)
      .digest('hex');

    try {
      return await redis.evalsha(sha, keys.length, ...keys, ...args);
    } catch (error: any) {
      if (error.message.includes('NOSCRIPT')) {
        // Script not cached, send it
        return await redis.eval(script, keys.length, ...keys, ...args);
      }
      throw error;
    }
  }

  /**
   * Scan keys efficiently with cursor
   */
  static async *scanKeys(
    redis: Redis,
    pattern: string,
    count: number = 100,
  ): AsyncGenerator<string[]> {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        count,
      );

      cursor = nextCursor;

      if (keys.length > 0) {
        yield keys;
      }
    } while (cursor !== '0');
  }

  /**
   * Delete keys by pattern efficiently
   */
  static async deleteByPattern(
    redis: Redis,
    pattern: string,
  ): Promise<number> {
    let totalDeleted = 0;

    for await (const keys of this.scanKeys(redis, pattern, 100)) {
      if (keys.length > 0) {
        totalDeleted += await redis.del(...keys);
      }
    }

    return totalDeleted;
  }
}
