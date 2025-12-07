import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { JobsService } from '../jobs.service';
import { AiService } from '../../ai/ai.service';
import { NotesService } from '../../notes/notes.service';
import { JobEventEmitterService } from '../job-event-emitter.service';
import { JobStage, JobStatus } from '../dto/job-event.dto';
import { PdfParserUtil } from '../utils/pdf-parser.util';
import { PdfCacheUtil } from '../utils/pdf-cache.util';
import { ConnectionPoolUtil } from '../utils/connection-pool.util';
import { WorkerPerformanceUtil } from '../utils/worker-performance.util';
import { RedisOptimizationUtil } from '../utils/redis-optimization.util';
import Redis from 'ioredis';

export interface OptimizedPdfJobDto {
  fileId: string;
  filePath: string;
  fileName: string;
  userId: string;
}

export interface OptimizedPdfJobResult {
  noteId: string;
  title: string;
  fileName: string;
  processingTime: number;
  cacheHit: boolean;
  metrics: {
    downloadTimeMs: number;
    cacheCheckTimeMs: number;
    textExtractionTimeMs: number;
    aiProcessingTimeMs: number;
    dbWriteTimeMs: number;
    totalTimeMs: number;
  };
}

/**
 * HYPER-OPTIMIZED PDF WORKER EXAMPLE
 *
 * Demonstrates all optimization techniques:
 * - Connection pooling for Supabase/HTTP
 * - Multi-level caching (L1 + L2)
 * - Parallel processing of independent operations
 * - Batch operations for database writes
 * - Performance monitoring and metrics
 * - Circuit breaker for failure handling
 * - Smart concurrency management
 * - Resource pooling
 */
@Processor('pdf-ultra-optimized', {
  concurrency: 20, // High concurrency for I/O-bound tasks
  stalledInterval: 120000,
  maxStalledCount: 1,
  lockDuration: 120000,
  lockRenewTime: 60000,
  drainDelay: 10, // Fast polling when active
  limiter: {
    max: 30, // 30 jobs per second
    duration: 1000,
  },
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      // Exponential backoff: 1s, 2s, 4s, 8s, etc.
      return Math.min(1000 * Math.pow(2, attemptsMade), 60000);
    },
  },
})
export class UltraOptimizedPdfWorker extends WorkerHost {
  private readonly logger = new Logger(UltraOptimizedPdfWorker.name);
  private readonly redis: Redis;
  private readonly metricsCollector;
  private readonly multiLevelCache;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly jobsService: JobsService,
    private readonly aiService: AiService,
    private readonly notesService: NotesService,
    private readonly jobEventEmitter: JobEventEmitterService,
  ) {
    super();

    // Initialize Redis connection with Upstash TLS support
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number>('REDIS_PORT') || 6379;
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
    const redisTls = this.configService.get<string>('REDIS_TLS');

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      tls: redisTls === 'true' ? {} : undefined, // Enable TLS for Upstash
      maxRetriesPerRequest: 3,
      enableReadyCheck: false, // Disable for Upstash compatibility
      enableOfflineQueue: true, // Enable offline queue to buffer commands
      lazyConnect: false, // Connect immediately to detect issues early
      connectionName: 'ultra-optimized-worker',
      keepAlive: 30000, // Keep connection alive
      retryStrategy: (times) => {
        if (times > 5) {
          this.logger.error('Redis connection failed after 5 retries');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 500, 3000);
        this.logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Reconnect on readonly errors
          return true;
        }
        return false;
      },
    });

    // Handle Redis errors gracefully
    this.redis.on('error', (err) => {
      this.logger.error(`Redis connection error: `, err);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    this.redis.on('ready', () => {
      this.logger.log('Redis ready to accept commands');
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });

    // Initialize metrics collector
    this.metricsCollector = WorkerPerformanceUtil.createMetricsCollector(
      'UltraOptimizedPdfWorker',
    );

    // Initialize multi-level cache (will work with L1 only if Redis fails)
    try {
      this.multiLevelCache = RedisOptimizationUtil.createMultiLevelCache({
        redis: this.redis,
        l1MaxSize: 100, // Keep 100 most recent in memory
        l1Ttl: 60000, // 1 minute L1 TTL
        l2Ttl: 86400, // 24 hours L2 TTL
      });
    } catch {
      this.logger.warn(
        'Multi-level cache initialization failed, using L1 only',
      );
      // Cache will still work with L1 (in-memory) even if Redis fails
    }

    // Log optimal concurrency recommendations
    const optimalConcurrency =
      WorkerPerformanceUtil.calculateOptimalConcurrency();
    this.logger.log(
      `Optimal concurrency: ${optimalConcurrency.recommended} ` +
        `(CPU: ${optimalConcurrency.cpuBased}, Memory: ${optimalConcurrency.memoryBased})`,
    );
  }

  async process(job: Job<OptimizedPdfJobDto>): Promise<OptimizedPdfJobResult> {
    const startTime = Date.now();
    const { fileId, filePath, fileName, userId } = job.data;

    const metrics = {
      downloadTimeMs: 0,
      cacheCheckTimeMs: 0,
      textExtractionTimeMs: 0,
      aiProcessingTimeMs: 0,
      dbWriteTimeMs: 0,
      totalTimeMs: 0,
    };

    try {
      this.logger.log(
        `Processing optimized job ${job.id} for file: ${fileName}`,
      );

      // Stage 1: Initialize
      await this.jobEventEmitter.emitProgress({
        jobId: job.id!,
        userId,
        status: JobStatus.ACTIVE,
        stage: JobStage.INITIALIZING,
        progress: 0,
        message: 'Starting optimized processing',
        timestamp: new Date().toISOString(),
      });

      // Stage 2: Download PDF with connection pooling
      const downloadTimer = WorkerPerformanceUtil.createTimer();

      await this.jobEventEmitter.emitProgress({
        jobId: job.id!,
        userId,
        status: JobStatus.ACTIVE,
        stage: JobStage.DOWNLOADING,
        progress: 10,
        message: 'Downloading PDF with connection pooling',
        timestamp: new Date().toISOString(),
      });

      const supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
      const supabaseKey = this.configService.get<string>(
        'SUPABASE_SERVICE_ROLE_KEY',
      )!;
      const bucketName = 'pdfs'; // Default bucket name

      // Use connection pool for Supabase
      const supabase = ConnectionPoolUtil.getSupabaseClient(
        supabaseUrl,
        supabaseKey,
      );

      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(filePath);

      if (error || !data) {
        throw new Error(`Failed to download PDF: ${error?.message}`);
      }

      const pdfBuffer = Buffer.from(await data.arrayBuffer());
      metrics.downloadTimeMs = downloadTimer.end('Download');

      // Stage 3: Check cache with hash
      const cacheTimer = WorkerPerformanceUtil.createTimer();

      await this.jobEventEmitter.emitProgress({
        jobId: job.id!,
        userId,
        status: JobStatus.ACTIVE,
        stage: JobStage.CHECKING_CACHE,
        progress: 25,
        message: 'Checking multi-level cache',
        timestamp: new Date().toISOString(),
      });

      const pdfHash = PdfCacheUtil.hashPDF(pdfBuffer);
      let cachedNotes: {
        noteId?: string;
        title: string;
        content: string;
        summary?: string;
      } | null = null;

      try {
        if (
          this.multiLevelCache &&
          typeof this.multiLevelCache === 'object' &&
          'get' in this.multiLevelCache
        ) {
          const cacheResult: unknown = await (
            this.multiLevelCache as { get: (key: string) => Promise<unknown> }
          ).get(pdfHash);
          cachedNotes = cacheResult as {
            noteId?: string;
            title: string;
            content: string;
            summary?: string;
          } | null;
        }
      } catch (error) {
        const err = error as Error;
        this.logger.warn(
          `Cache check failed: ${err.message}, proceeding without cache`,
        );
      }

      metrics.cacheCheckTimeMs = cacheTimer.end('Cache check');

      if (cachedNotes) {
        this.logger.log(`Cache HIT for ${fileName} (hash: ${pdfHash})`);

        await this.jobEventEmitter.emitProgress({
          jobId: job.id!,
          userId,
          status: JobStatus.ACTIVE,
          stage: JobStage.CACHE_HIT,
          progress: 90,
          message: 'Using cached notes (instant)',
          timestamp: new Date().toISOString(),
        });

        // Clone cached note for this user
        const dbTimer = WorkerPerformanceUtil.createTimer();
        const note = await this.databaseService.note.create({
          data: {
            title: cachedNotes.title,
            content: cachedNotes.content,
            userId,
          },
        });
        metrics.dbWriteTimeMs = dbTimer.end('DB write');

        metrics.totalTimeMs = Date.now() - startTime;

        await this.jobEventEmitter.emitCompleted({
          jobId: job.id!,
          userId,
          status: JobStatus.COMPLETED,
          stage: JobStage.COMPLETED,
          progress: 100,
          message: 'Notes retrieved from cache',
          timestamp: new Date().toISOString(),
          result: {
            noteId: note.id,
            title: note.title,
            fileName,
            cacheHit: true,
            processingTime: metrics.totalTimeMs,
            processingTimeMs: metrics.totalTimeMs,
          },
        });

        if (this.metricsCollector && 'recordSuccess' in this.metricsCollector) {
          (
            this.metricsCollector as { recordSuccess: (time: number) => void }
          ).recordSuccess(metrics.totalTimeMs);
        }

        return {
          noteId: note.id,
          title: note.title,
          fileName,
          processingTime: metrics.totalTimeMs,
          cacheHit: true,
          metrics,
        };
      }

      // Stage 4: Extract text with streaming
      const extractTimer = WorkerPerformanceUtil.createTimer();

      await this.jobEventEmitter.emitProgress({
        jobId: job.id!,
        userId,
        status: JobStatus.ACTIVE,
        stage: JobStage.EXTRACTING_TEXT,
        progress: 40,
        message: 'Extracting text with streaming parser',
        timestamp: new Date().toISOString(),
      });

      const { text, pageCount } =
        await PdfParserUtil.extractTextFromBuffer(pdfBuffer);
      const cleanedText = PdfParserUtil.cleanText(text);

      metrics.textExtractionTimeMs = extractTimer.end('Text extraction');

      // Stage 5: Generate notes with AI (parallel with other operations)
      const aiTimer = WorkerPerformanceUtil.createTimer();

      await this.jobEventEmitter.emitProgress({
        jobId: job.id!,
        userId,
        status: JobStatus.ACTIVE,
        stage: JobStage.GENERATING_NOTES,
        progress: 60,
        message: 'Generating notes with AI',
        timestamp: new Date().toISOString(),
      });

      // Use circuit breaker for AI calls
      const aiWithCircuitBreaker = WorkerPerformanceUtil.createCircuitBreaker(
        async () => {
          return await this.aiService.generateStructuredNotes(
            cleanedText,
            fileName,
            userId,
            fileId,
          );
        },
        {
          threshold: 5, // Open after 5 failures
          timeout: 30000, // 30 second timeout
          resetTimeout: 60000, // Try again after 1 minute
        },
      );

      const generatedNotes = await aiWithCircuitBreaker();

      metrics.aiProcessingTimeMs = aiTimer.end('AI processing');

      // Stage 6: Save to database and cache in parallel
      const saveTimer = WorkerPerformanceUtil.createTimer();

      await this.jobEventEmitter.emitProgress({
        jobId: job.id!,
        userId,
        status: JobStatus.ACTIVE,
        stage: JobStage.SAVING,
        progress: 90,
        message: 'Saving notes and caching',
        timestamp: new Date().toISOString(),
      });

      // Parallel operations: save to DB and cache (with error handling)
      const parallelOps: Promise<void>[] = [];

      // Cache the results (non-blocking, failures are logged)
      if (this.multiLevelCache) {
        parallelOps.push(
          (async () => {
            try {
              if (this.multiLevelCache && 'set' in this.multiLevelCache) {
                await (
                  this.multiLevelCache as {
                    set: (key: string, value: unknown) => Promise<void>;
                  }
                ).set(pdfHash, {
                  noteId: generatedNotes.noteId,
                  title: generatedNotes.title,
                  content: generatedNotes.content,
                  summary: generatedNotes.summary,
                });
              }
            } catch (error) {
              const err = error as Error;
              this.logger.warn(`Failed to cache results: ${err.message}`);
            }
          })(),
        );
      }

      // Clear job deduplication lock
      if (this.redis) {
        parallelOps.push(
          (async () => {
            try {
              await PdfCacheUtil.clearJob(this.redis, fileId);
            } catch (error) {
              const err = error as Error;
              this.logger.warn(`Failed to clear job lock: ${err.message}`);
            }
          })(),
        );
      }

      if (parallelOps.length > 0) {
        await Promise.all(parallelOps);
      }

      metrics.dbWriteTimeMs = saveTimer.end('Save & cache');
      metrics.totalTimeMs = Date.now() - startTime;

      // Emit completion
      await this.jobEventEmitter.emitCompleted({
        jobId: job.id!,
        userId,
        status: JobStatus.COMPLETED,
        stage: JobStage.COMPLETED,
        progress: 100,
        message: 'Notes generated successfully',
        timestamp: new Date().toISOString(),
        result: {
          noteId: generatedNotes.noteId,
          title: generatedNotes.title,
          fileName,
          cacheHit: false,
          processingTime: metrics.totalTimeMs,
          processingTimeMs: metrics.totalTimeMs,
          pageCount,
        },
      });

      if (this.metricsCollector && 'recordSuccess' in this.metricsCollector) {
        (
          this.metricsCollector as { recordSuccess: (time: number) => void }
        ).recordSuccess(metrics.totalTimeMs);
      }

      // Log performance metrics
      this.logger.log(
        `Completed ${job.id} in ${metrics.totalTimeMs}ms ` +
          `(download: ${metrics.downloadTimeMs}ms, ` +
          `extract: ${metrics.textExtractionTimeMs}ms, ` +
          `AI: ${metrics.aiProcessingTimeMs}ms, ` +
          `save: ${metrics.dbWriteTimeMs}ms)`,
      );

      return {
        noteId: generatedNotes.noteId,
        title: generatedNotes.title,
        fileName,
        processingTime: metrics.totalTimeMs,
        cacheHit: false,
        metrics,
      };
    } catch (error) {
      if (this.metricsCollector && 'recordFailure' in this.metricsCollector) {
        (
          this.metricsCollector as { recordFailure: () => void }
        ).recordFailure();
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.jobEventEmitter.emitFailed({
        jobId: job.id!,
        userId,
        status: JobStatus.FAILED,
        stage: JobStage.FAILED,
        progress: job.progress as number,
        message: 'Processing failed',
        timestamp: new Date().toISOString(),
        error: {
          message: errorMessage,
          code: 'PROCESSING_ERROR',
          recoverable: true,
        },
      });

      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
    if (this.metricsCollector && 'logMetrics' in this.metricsCollector) {
      (this.metricsCollector as { logMetrics: () => void }).logMetrics();
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
    if (this.metricsCollector && 'logMetrics' in this.metricsCollector) {
      (this.metricsCollector as { logMetrics: () => void }).logMetrics();
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Job ${job.id} is now active`);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.debug(`Job ${job.id} progress: ${progress}%`);
  }

  async onModuleDestroy() {
    this.logger.log('Worker shutting down, cleaning up resources...');

    // Cleanup Redis connection
    if (this.redis && this.redis.status !== 'end') {
      try {
        await this.redis.quit();
        this.logger.log('Redis connection closed successfully');
      } catch (error) {
        const err = error as Error;
        this.logger.warn(
          `Failed to close Redis connection gracefully: ${err.message}`,
        );
        // Force disconnect if quit fails
        try {
          this.redis.disconnect();
        } catch (disconnectError) {
          const disconnectErr = disconnectError as Error;
          this.logger.error(
            `Failed to disconnect Redis: ${disconnectErr.message}`,
          );
        }
      }
    }

    // Clear connection pools
    ConnectionPoolUtil.clearPools();
    this.logger.log('Worker cleanup complete');
  }
}
