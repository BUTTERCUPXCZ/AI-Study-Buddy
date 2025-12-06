import { Logger } from '@nestjs/common';

/**
 * Worker Performance Optimization Utilities
 * 
 * Provides tools for monitoring, profiling, and optimizing background job performance.
 */
export class WorkerPerformanceUtil {
  private static readonly logger = new Logger('WorkerPerformanceUtil');

  /**
   * Performance timer for tracking operation duration
   */
  static createTimer() {
    const start = performance.now();
    return {
      elapsed: () => performance.now() - start,
      end: (label?: string) => {
        const duration = performance.now() - start;
        if (label) {
          this.logger.debug(`${label}: ${duration.toFixed(2)}ms`);
        }
        return duration;
      },
    };
  }

  /**
   * Track memory usage before and after operation
   */
  static async trackMemory<T>(
    operation: () => Promise<T>,
    label: string,
  ): Promise<T> {
    const memBefore = process.memoryUsage();
    const timer = this.createTimer();

    try {
      const result = await operation();
      const memAfter = process.memoryUsage();
      const duration = timer.elapsed();

      this.logger.debug(`${label} completed in ${duration.toFixed(2)}ms`);
      this.logger.debug(
        `Memory: heap ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)}MB`,
      );

      return result;
    } catch (error) {
      this.logger.error(`${label} failed: ${error}`);
      throw error;
    }
  }

  /**
   * Execute operations in parallel batches to control concurrency
   */
  static async parallelBatch<T, R>(
    items: T[],
    batchSize: number,
    processor: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          this.logger.warn(
            `Attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Sleep utility
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a throttled function that limits execution rate
   */
  static throttle<T extends (...args: any[]) => any>(
    fn: T,
    delayMs: number,
  ): T {
    let lastRun = 0;
    let timeout: NodeJS.Timeout | null = null;

    return ((...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRun;

      if (timeSinceLastRun >= delayMs) {
        lastRun = now;
        return fn(...args);
      } else {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          lastRun = Date.now();
          fn(...args);
        }, delayMs - timeSinceLastRun);
      }
    }) as T;
  }

  /**
   * Create a debounced function that delays execution
   */
  static debounce<T extends (...args: any[]) => any>(
    fn: T,
    delayMs: number,
  ): T {
    let timeout: NodeJS.Timeout | null = null;

    return ((...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delayMs);
    }) as T;
  }

  /**
   * Calculate optimal concurrency based on system resources
   */
  static calculateOptimalConcurrency(): {
    cpuBased: number;
    memoryBased: number;
    recommended: number;
  } {
    const cpuCount = require('os').cpus().length;
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();

    // CPU-based: number of cores * 2 (for I/O-bound tasks)
    const cpuBased = cpuCount * 2;

    // Memory-based: ensure at least 500MB per worker
    const memoryBased = Math.floor(freeMemory / (500 * 1024 * 1024));

    // Recommended: conservative approach
    const recommended = Math.min(cpuBased, memoryBased, 20);

    return {
      cpuBased,
      memoryBased,
      recommended: Math.max(recommended, 2), // At least 2
    };
  }

  /**
   * Monitor queue health metrics
   */
  static async getQueueHealthMetrics(queue: any): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    isPaused: boolean;
    processingRate: number;
  }> {
    const [waiting, active, completed, failed, delayed, isPaused] =
      await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);

    // Calculate processing rate (jobs per minute)
    const processingRate = completed > 0 ? (completed / (Date.now() / 60000)) : 0;

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      isPaused,
      processingRate,
    };
  }

  /**
   * Smart chunking for large text processing
   * Splits text into optimal chunks based on token limits
   */
  static smartChunk(
    text: string,
    maxChunkSize: number = 8000,
    overlap: number = 200,
  ): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if ((currentChunk + paragraph).length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          // Add overlap from previous chunk
          const words = currentChunk.split(' ');
          currentChunk = words.slice(-overlap / 5).join(' ') + '\n\n';
        }
      }
      currentChunk += paragraph + '\n\n';
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  }

  /**
   * Create a circuit breaker for failing operations
   */
  static createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: {
      threshold: number; // Number of failures before opening
      timeout: number; // Time to wait before trying again (ms)
      resetTimeout: number; // Time to wait before closing circuit (ms)
    },
  ) {
    let failureCount = 0;
    let lastFailureTime = 0;
    let state: 'closed' | 'open' | 'half-open' = 'closed';

    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const now = Date.now();

      // Check if circuit should be half-open
      if (
        state === 'open' &&
        now - lastFailureTime > options.resetTimeout
      ) {
        state = 'half-open';
        this.logger.log('Circuit breaker entering half-open state');
      }

      // Reject if circuit is open
      if (state === 'open') {
        throw new Error('Circuit breaker is open');
      }

      try {
        const result = await fn(...args);

        // Reset on success
        if (state === 'half-open') {
          state = 'closed';
          failureCount = 0;
          this.logger.log('Circuit breaker closed');
        }

        return result;
      } catch (error) {
        failureCount++;
        lastFailureTime = now;

        if (failureCount >= options.threshold) {
          state = 'open';
          this.logger.error(
            `Circuit breaker opened after ${failureCount} failures`,
          );
        }

        throw error;
      }
    };
  }

  /**
   * Measure and log worker metrics
   */
  static createMetricsCollector(workerName: string) {
    const metrics = {
      jobsProcessed: 0,
      jobsFailed: 0,
      totalProcessingTime: 0,
      avgProcessingTime: 0,
      startTime: Date.now(),
    };

    return {
      recordSuccess: (duration: number) => {
        metrics.jobsProcessed++;
        metrics.totalProcessingTime += duration;
        metrics.avgProcessingTime =
          metrics.totalProcessingTime / metrics.jobsProcessed;
      },

      recordFailure: () => {
        metrics.jobsFailed++;
      },

      getMetrics: () => ({
        ...metrics,
        uptime: Date.now() - metrics.startTime,
        successRate:
          metrics.jobsProcessed / (metrics.jobsProcessed + metrics.jobsFailed),
      }),

      logMetrics: () => {
        const m = metrics;
        this.logger.log(
          `[${workerName}] Processed: ${m.jobsProcessed}, Failed: ${m.jobsFailed}, ` +
            `Avg Time: ${m.avgProcessingTime.toFixed(2)}ms`,
        );
      },
    };
  }
}
