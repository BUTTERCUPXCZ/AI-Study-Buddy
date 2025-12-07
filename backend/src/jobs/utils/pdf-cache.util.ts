import { createHash } from 'crypto';
import { Redis } from 'ioredis';
import { Logger } from '@nestjs/common';

/**
 * PDF Caching Utility - Dramatically speeds up duplicate PDF processing
 * Uses SHA-256 hash of PDF content as cache key
 */
export class PdfCacheUtil {
  private static readonly logger = new Logger('PdfCacheUtil');
  private static readonly CACHE_PREFIX = 'pdf:notes:';
  private static readonly CACHE_TTL = 86400; // 24 hours
  private static readonly JOB_PREFIX = 'pdf:job:';
  private static readonly JOB_TTL = 300; // 5 minutes

  /**
   * Generate SHA-256 hash of PDF buffer for caching
   * Same PDF content = same hash = cache hit
   */
  static hashPDF(buffer: Buffer): string {
    const hash = createHash('sha256').update(buffer).digest('hex');
    this.logger.log(`PDF hash: ${hash.substring(0, 16)}...`);
    return hash;
  }

  /**
   * Check if notes already exist for this PDF (by hash)
   * Returns cached notes instantly if available
   */
  static async getCachedNotes(
    redis: Redis,
    pdfHash: string,
  ): Promise<{
    noteId: string;
    title: string;
    content: string;
    summary: string;
  } | null> {
    if (!redis || redis.status !== 'ready') {
      this.logger.warn('Redis not ready, skipping cache lookup');
      return null;
    }

    try {
      const key = `${this.CACHE_PREFIX}${pdfHash}`;
      const cached = await redis.get(key);

      if (cached) {
        this.logger.log(`✅ Cache HIT for ${pdfHash.substring(0, 16)}...`);
        return JSON.parse(cached) as { noteId: string; title: string; content: string; summary: string; } | null;
      }

      this.logger.log(`❌ Cache MISS for ${pdfHash.substring(0, 16)}...`);
      return null;
    } catch (error) {
      this.logger.error('Cache lookup failed:', error);
      return null;
    }
  }

  /**
   * Cache generated notes for future requests
   * Saves 30-50 seconds on duplicate PDFs
   */
  static async cacheNotes(
    redis: Redis,
    pdfHash: string,
    notes: {
      noteId: string;
      title: string;
      content: string;
      summary: string;
    },
  ): Promise<void> {
    if (!redis || redis.status !== 'ready') {
      this.logger.warn('Redis not ready, skipping cache write');
      return;
    }

    try {
      const key = `${this.CACHE_PREFIX}${pdfHash}`;
      await redis.setex(key, this.CACHE_TTL, JSON.stringify(notes));
      this.logger.log(
        `✅ Cached notes for ${pdfHash.substring(0, 16)}... (TTL: 24h)`,
      );
    } catch (error) {
      this.logger.error('Failed to cache notes:', error);
    }
  }

  /**
   * Job deduplication - prevent processing same file multiple times
   * If job exists, return its ID instead of creating new one
   */
  static async getExistingJob(
    redis: Redis,
    fileId: string,
  ): Promise<string | null> {
    if (!redis || redis.status !== 'ready') {
      this.logger.warn('Redis not ready, skipping job lookup');
      return null;
    }

    try {
      const key = `${this.JOB_PREFIX}${fileId}`;
      const existingJobId = await redis.get(key);

      if (existingJobId) {
        this.logger.log(
          `Found existing job ${existingJobId} for file ${fileId}`,
        );
        return existingJobId;
      }

      return null;
    } catch (error) {
      this.logger.error('Job lookup failed:', error);
      return null;
    }
  }

  /**
   * Register new job to prevent duplicates
   */
  static async registerJob(
    redis: Redis,
    fileId: string,
    jobId: string,
  ): Promise<void> {
    if (!redis || redis.status !== 'ready') {
      this.logger.warn('Redis not ready, skipping job registration');
      return;
    }

    try {
      const key = `${this.JOB_PREFIX}${fileId}`;
      await redis.setex(key, this.JOB_TTL, jobId);
      this.logger.log(`Registered job ${jobId} for file ${fileId}`);
    } catch (error) {
      this.logger.error('Failed to register job:', error);
    }
  }

  /**
   * Clear job registration after completion
   */
  static async clearJob(redis: Redis, fileId: string): Promise<void> {
    if (!redis || redis.status !== 'ready') {
      this.logger.warn(`Redis not ready, skipping job clear for ${fileId}`);
      return;
    }

    try {
      const key = `${this.JOB_PREFIX}${fileId}`;
      await redis.del(key);
      this.logger.log(`Cleared job registration for file ${fileId}`);
    } catch (error) {
      this.logger.error('Failed to clear job:', error);
    }
  }

  /**
   * Invalidate cache for a specific PDF hash
   * Useful when notes need to be regenerated
   */
  static async invalidateCache(redis: Redis, pdfHash: string): Promise<void> {
    if (!redis || redis.status !== 'ready') {
      this.logger.warn('Redis not ready, skipping cache invalidation');
      return;
    }

    try {
      const key = `${this.CACHE_PREFIX}${pdfHash}`;
      await redis.del(key);
      this.logger.log(`Invalidated cache for ${pdfHash.substring(0, 16)}...`);
    } catch (error) {
      this.logger.error('Failed to invalidate cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(redis: Redis): Promise<{
    totalKeys: number;
    cacheSize: number;
    hitRate: number;
  }> {
    try {
      const keys = await redis.keys(`${this.CACHE_PREFIX}*`);
      const totalKeys = keys.length;

      // This is a simple implementation - in production, use Redis INFO stats
      return {
        totalKeys,
        cacheSize: totalKeys * 1024, // Rough estimate
        hitRate: 0, // Would need to track hits/misses
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return { totalKeys: 0, cacheSize: 0, hitRate: 0 };
    }
  }
}
