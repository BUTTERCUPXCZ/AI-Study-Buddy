import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { JobsService } from '../jobs.service';
import { PdfCacheUtil } from '../utils/pdf-cache.util';
import Redis from 'ioredis';

export interface CreatePdfUltraOptimizedJobDto {
  fileId: string;
  filePath: string;
  fileName: string;
  userId: string;
}

/**
 * Ultra-Optimized PDF Queue with all performance enhancements:
 * - Connection pooling
 * - Multi-level caching
 * - Job deduplication
 * - Smart priority handling
 * - Circuit breakers
 */
@Injectable()
export class PdfUltraOptimizedQueue {
  private readonly logger = new Logger(PdfUltraOptimizedQueue.name);
  private redis: Redis;

  constructor(
    @InjectQueue('pdf-ultra-optimized')
    private pdfQueue: Queue<CreatePdfUltraOptimizedJobDto>,
    private readonly jobsService: JobsService,
    private readonly configService: ConfigService,
  ) {
    // Initialize Redis for job deduplication with proper error handling
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number>('REDIS_PORT');
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
    const redisTls = this.configService.get<string>('REDIS_TLS');

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      tls: redisTls === 'true' ? {} : undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.error('Redis connection failed');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    this.redis.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  /**
   * Add ultra-optimized PDF job with deduplication
   */
  async addPdfJob(data: CreatePdfUltraOptimizedJobDto) {
    try {
      this.logger.log(
        `Adding ultra-optimized PDF job for file: ${data.fileName}`,
      );

      // Check for existing job (deduplication) - only if Redis available
      if (this.redis) {
        try {
          const existingJobId = await PdfCacheUtil.getExistingJob(
            this.redis,
            data.fileId,
          );

          if (existingJobId) {
            this.logger.log(
              `Job already exists for file ${data.fileId}: ${existingJobId}`,
            );
            return { jobId: existingJobId, deduplicated: true };
          }
        } catch (error) {
          const err = error as Error;
          this.logger.warn(`Deduplication check failed: ${err.message}`);
        }
      }

      // Calculate priority (lower = higher priority)
      const priority = this.calculatePriority(data.fileName);

      // Add job to BullMQ queue
      const job = await this.pdfQueue.add('process-pdf', data, {
        priority,
        removeOnComplete: {
          age: 3600, // 1 hour
          count: 1000,
        },
        removeOnFail: {
          age: 86400, // 24 hours
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });

      // Register job in deduplication cache (if Redis available)
      if (this.redis) {
        try {
          await PdfCacheUtil.registerJob(this.redis, data.fileId, job.id!);
        } catch (error) {
          const err = error as Error;
          this.logger.warn(`Failed to register job in cache: ${err.message}`);
        }
      }

      // Create job record in database
      await this.jobsService.createJobRecord({
        jobId: job.id!,
        name: 'process-pdf',
        queueName: 'pdf-ultra-optimized',
        data,
        userId: data.userId,
        opts: {
          priority,
          attempts: 3,
        },
      });

      this.logger.log(
        `Ultra-optimized PDF job created: ${job.id} (priority: ${priority})`,
      );

      return { jobId: job.id, deduplicated: false };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to add ultra-optimized PDF job: ${err.message}`,
      );
      throw error;
    }
  }

  /**
   * Calculate job priority based on file characteristics
   * Lower number = higher priority
   */
  private calculatePriority(fileName: string): number {
    const lowerName = fileName.toLowerCase();

    // High priority for common study materials
    if (
      lowerName.includes('exam') ||
      lowerName.includes('quiz') ||
      lowerName.includes('test')
    ) {
      return 1;
    }

    // Medium priority for lectures and notes
    if (
      lowerName.includes('lecture') ||
      lowerName.includes('note') ||
      lowerName.includes('chapter')
    ) {
      return 5;
    }

    // Normal priority
    return 10;
  }

  /**
   * Get job status with additional metrics
   */
  async getJobStatus(jobId: string) {
    const job = await this.pdfQueue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      jobId: job.id,
      name: job.name,
      data: job.data,
      state,
      progress,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      priority: job.opts.priority,
    };
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.pdfQueue.getWaitingCount(),
      this.pdfQueue.getActiveCount(),
      this.pdfQueue.getCompletedCount(),
      this.pdfQueue.getFailedCount(),
      this.pdfQueue.getDelayedCount(),
    ]);

    return {
      queue: 'pdf-ultra-optimized',
      counts: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      },
    };
  }

  /**
   * Pause the queue
   */
  async pauseQueue() {
    await this.pdfQueue.pause();
    this.logger.log('Ultra-optimized PDF queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue() {
    await this.pdfQueue.resume();
    this.logger.log('Ultra-optimized PDF queue resumed');
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(grace: number = 3600000) {
    await this.pdfQueue.clean(grace, 1000, 'completed');
    await this.pdfQueue.clean(grace * 24, 1000, 'failed');
    this.logger.log('Ultra-optimized PDF queue cleaned');
  }

  /**
   * Invalidate cache for a specific file (force reprocessing)
   */
  async invalidateCacheForFile(pdfHash: string) {
    if (this.redis) {
      try {
        await PdfCacheUtil.invalidateCache(this.redis, pdfHash);
        this.logger.log(`Cache invalidated for PDF hash: ${pdfHash}`);
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`Failed to invalidate cache: ${err.message}`);
      }
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`Failed to close Redis connection: ${err.message}`);
      }
    }
  }
}
