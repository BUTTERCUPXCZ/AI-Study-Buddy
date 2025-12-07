import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JobsService } from '../jobs.service';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { PdfCacheUtil } from '../utils/pdf-cache.util';

export interface CreatePdfNotesOptimizedJobDto {
  fileId: string;
  filePath: string;
  fileName: string;
  userId: string;
}

/**
 * Optimized PDF Notes Queue with:
 * - Job deduplication
 * - Priority handling
 * - Smart routing (fast vs standard)
 */
@Injectable()
export class PdfNotesOptimizedQueue {
  private readonly logger = new Logger(PdfNotesOptimizedQueue.name);
  private redis: Redis;

  constructor(
    @InjectQueue('pdf-notes-optimized')
    private pdfNotesQueue: Queue<CreatePdfNotesOptimizedJobDto>,
    private readonly jobsService: JobsService,
    private readonly configService: ConfigService,
  ) {
    // Initialize Redis for job deduplication
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST')!,
      port: this.configService.get<number>('REDIS_PORT')!,
      password: this.configService.get<string>('REDIS_PASSWORD'),
      tls: this.configService.get<string>('REDIS_PASSWORD') ? {} : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
    });
  }

  /**
   * Add optimized PDF notes job with deduplication
   */
  async addPdfNotesJob(data: CreatePdfNotesOptimizedJobDto) {
    try {
      this.logger.log(`[OPTIMIZED QUEUE] Adding job: ${data.fileName}`);

      // ============ JOB DEDUPLICATION ============
      // Check if this file is already being processed
      const existingJobId = await PdfCacheUtil.getExistingJob(
        this.redis,
        data.fileId,
      );

      if (existingJobId) {
        this.logger.log(
          `[DEDUP] File ${data.fileId} already processing in job ${existingJobId}`,
        );
        return {
          jobId: existingJobId,
          message: 'Joined existing job (deduplication)',
          deduplicated: true,
        };
      }

      // ============ PRIORITY HANDLING ============
      // Smaller files get higher priority for faster perceived performance
      const fileSizePriority = this.calculatePriority(data.fileName);

      // Generate unique job ID
      const uniqueJobId = `pdf-notes-opt-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // ============ QUEUE JOB ============
      const job = await this.pdfNotesQueue.add(
        'generate-notes-optimized',
        {
          fileId: data.fileId,
          filePath: data.filePath,
          fileName: data.fileName,
          userId: data.userId,
        },
        {
          jobId: uniqueJobId,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 3600, // 1 hour
            count: 100,
          },
          removeOnFail: {
            age: 86400, // 24 hours
          },
          priority: fileSizePriority, // Higher priority for smaller files
        },
      );

      this.logger.log(
        `[QUEUED] Job ${job.id} with priority ${fileSizePriority}`,
      );

      // ============ REGISTER JOB FOR DEDUPLICATION ============
      await PdfCacheUtil.registerJob(this.redis, data.fileId, job.id!);

      // ============ SAVE TO DATABASE ============
      await this.jobsService.createJobRecord({
        jobId: job.id!,
        name: 'generate-notes-optimized',
        queueName: 'pdf-notes-optimized',
        data: data,
        userId: data.userId,
        opts: job.opts,
      });

      return {
        jobId: job.id,
        message: 'PDF notes generation job queued (optimized)',
        deduplicated: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[ERROR] Failed to queue job: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Calculate job priority based on file characteristics
   * Lower number = higher priority
   */
  private calculatePriority(fileName: string): number {
    // Estimate file size from name (rough heuristic)
    // In production, you'd pass actual file size
    const nameLengthHeuristic = fileName.length;

    if (nameLengthHeuristic < 20) {
      return 1; // Highest priority - likely small file
    } else if (nameLengthHeuristic < 40) {
      return 5; // Medium priority
    } else {
      return 10; // Lower priority - likely larger file
    }
  }

  /**
   * Get job status with additional optimized metrics
   */
  async getJobStatus(jobId: string) {
    const job = await this.pdfNotesQueue.getJob(jobId);

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
      returnvalue: job.returnvalue as unknown, // Includes metrics!
    };
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.pdfNotesQueue.getWaitingCount(),
      this.pdfNotesQueue.getActiveCount(),
      this.pdfNotesQueue.getCompletedCount(),
      this.pdfNotesQueue.getFailedCount(),
      this.pdfNotesQueue.getDelayedCount(),
    ]);

    return {
      queue: 'pdf-notes-optimized',
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
    await this.pdfNotesQueue.pause();
    this.logger.log('Optimized queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue() {
    await this.pdfNotesQueue.resume();
    this.logger.log('Optimized queue resumed');
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(grace: number = 3600000) {
    const cleaned = await this.pdfNotesQueue.clean(grace, 100, 'completed');
    this.logger.log(`Cleaned ${cleaned.length} completed jobs`);
    return cleaned.length;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return await PdfCacheUtil.getCacheStats(this.redis);
  }

  /**
   * Invalidate cache for a specific file (force reprocessing)
   */
  async invalidateCacheForFile(pdfHash: string) {
    await PdfCacheUtil.invalidateCache(this.redis, pdfHash);
    this.logger.log(
      `Invalidated cache for hash ${pdfHash.substring(0, 16)}...`,
    );
  }
}
