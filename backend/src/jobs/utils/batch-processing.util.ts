import { Logger } from '@nestjs/common';

/**
 * Batch Processing Utilities
 *
 * Optimizes processing of large datasets by batching operations,
 * parallel execution, and intelligent chunking.
 */
export class BatchProcessingUtil {
  private static readonly logger = new Logger('BatchProcessingUtil');

  /**
   * Process items in parallel batches with concurrency control
   */
  static async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      batchSize?: number;
      concurrency?: number;
      onProgress?: (completed: number, total: number) => void;
      onError?: (item: T, error: Error) => void;
      continueOnError?: boolean;
    } = {},
  ): Promise<R[]> {
    const {
      batchSize = 10,
      concurrency = 5,
      onProgress,
      onError,
      continueOnError = false,
    } = options;

    const results: R[] = [];
    let completed = 0;

    // Process in batches to control memory usage
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      // Process batch with controlled concurrency
      const batchResults = await this.processWithConcurrency(
        batch,
        processor,
        concurrency,
        continueOnError,
        onError,
      );

      results.push(...(batchResults.filter((r) => r !== null) as R[]));
      completed += batch.length;

      if (onProgress) {
        onProgress(completed, items.length);
      }
    }

    return results;
  }

  /**
   * Process items with controlled concurrency
   */
  private static async processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number,
    continueOnError: boolean,
    onError?: (item: T, error: Error) => void,
  ): Promise<(R | null)[]> {
    const results: (R | null)[] = new Array<R | null>(items.length).fill(null);
    const executing: Promise<void>[] = [];

    for (let i = 0; i < items.length; i++) {
      const index = i;
      const item = items[i];

      const promise = (async () => {
        try {
          results[index] = await processor(item);
        } catch (error) {
          this.logger.error(`Error processing item ${index}: ${error}`);

          if (onError) {
            onError(item, error as Error);
          }

          if (!continueOnError) {
            throw error;
          }
        }
      })();

      const promiseToExecute = promise;
      executing.push(promiseToExecute);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        const completedIndex = executing.findIndex(
          (p) => Promise.resolve(p) === Promise.resolve(promiseToExecute),
        );
        if (completedIndex !== -1) {
          executing.splice(completedIndex, 1);
        }
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Map-reduce pattern for parallel processing
   */
  static async mapReduce<T, M, R>(
    items: T[],
    mapper: (item: T) => Promise<M>,
    reducer: (mapped: M[]) => R,
    options: {
      mapConcurrency?: number;
      batchSize?: number;
    } = {},
  ): Promise<R> {
    const { mapConcurrency = 10, batchSize = 100 } = options;

    const mapped: M[] = [];

    // Map phase with batching
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const batchResults = await this.processWithConcurrency(
        batch,
        mapper,
        mapConcurrency,
        false,
      );

      mapped.push(...(batchResults.filter((r) => r !== null) as M[]));
    }

    // Reduce phase
    return reducer(mapped);
  }

  /**
   * Process stream of data in chunks
   */
  static async processStream<T, R>(
    stream: AsyncIterable<T>,
    processor: (chunk: T[]) => Promise<R[]>,
    chunkSize: number = 100,
  ): Promise<R[]> {
    const results: R[] = [];
    let chunk: T[] = [];

    for await (const item of stream) {
      chunk.push(item);

      if (chunk.length >= chunkSize) {
        const chunkResults = await processor(chunk);
        results.push(...chunkResults);
        chunk = [];
      }
    }

    // Process remaining items
    if (chunk.length > 0) {
      const chunkResults = await processor(chunk);
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Split large array into optimal chunks based on system resources
   */
  static smartSplit<T>(
    items: T[],
    options?: {
      maxChunkSize?: number;
      targetChunks?: number;
    },
  ): T[][] {
    const { maxChunkSize = 1000, targetChunks } = options || {};

    let chunkSize: number;

    if (targetChunks) {
      chunkSize = Math.ceil(items.length / targetChunks);
    } else {
      chunkSize = Math.min(maxChunkSize, Math.ceil(items.length / 10));
    }

    const chunks: T[][] = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * Parallel processing with rate limiting
   */
  static async processWithRateLimit<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      rateLimit: number; // operations per second
      concurrency?: number;
    },
  ): Promise<R[]> {
    const { rateLimit, concurrency = 5 } = options;
    const intervalMs = 1000 / rateLimit;

    const results: R[] = [];
    const executing: Promise<void>[] = [];
    let lastExecutionTime = Date.now();

    for (const item of items) {
      // Rate limiting
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecutionTime;

      if (timeSinceLastExecution < intervalMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, intervalMs - timeSinceLastExecution),
        );
      }

      lastExecutionTime = Date.now();

      // Process with concurrency control
      const promise = (async () => {
        try {
          const result = await processor(item);
          results.push(result);
        } catch (error) {
          this.logger.error(`Error processing item: ${error}`);
          throw error;
        }
      })();

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        // Remove the first completed promise
        executing.splice(0, 1);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Fan-out/fan-in pattern for distributed processing
   */
  static async fanOutFanIn<T, R>(
    items: T[],
    workers: Array<(item: T) => Promise<R>>,
    options: {
      strategy?: 'round-robin' | 'random' | 'least-busy';
    } = {},
  ): Promise<R[]> {
    const { strategy = 'round-robin' } = options;
    const results: R[] = new Array<R>(items.length);
    const workerLoads = new Array(workers.length).fill(0);

    const selectWorker = (index: number): number => {
      switch (strategy) {
        case 'round-robin':
          return index % workers.length;
        case 'random':
          return Math.floor(Math.random() * workers.length);
        case 'least-busy': {
          const minLoad = Math.min(...(workerLoads as number[]));
          return workerLoads.indexOf(minLoad);
        }
        default:
          return 0;
      }
    };

    const promises = items.map(async (item, index) => {
      const workerIndex = selectWorker(index);
      workerLoads[workerIndex]++;

      try {
        results[index] = await workers[workerIndex](item);
      } finally {
        workerLoads[workerIndex]--;
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Process with retry logic and exponential backoff
   */
  static async processWithRetry<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      onRetry?: (item: T, attempt: number, error: Error) => void;
    } = {},
  ): Promise<R[]> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      onRetry,
    } = options;

    const results: R[] = [];

    for (const item of items) {
      let lastError: Error;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await processor(item);
          results.push(result);
          break; // Success
        } catch (error) {
          lastError = error as Error;

          if (attempt < maxRetries) {
            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

            if (onRetry) {
              onRetry(item, attempt + 1, lastError);
            }

            this.logger.warn(
              `Retry ${attempt + 1}/${maxRetries} after ${delay}ms`,
            );

            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // If all retries failed, throw the last error
      if (lastError!) {
        throw new Error(
          `Failed to process item after ${maxRetries} retries: ${lastError!.message}`,
        );
      }
    }

    return results;
  }

  /**
   * Process items with priority queue
   */
  static async processWithPriority<T, R>(
    items: Array<{ item: T; priority: number }>,
    processor: (item: T) => Promise<R>,
    concurrency: number = 5,
  ): Promise<R[]> {
    // Sort by priority (higher number = higher priority)
    const sorted = [...items].sort((a, b) => b.priority - a.priority);

    return this.processBatch(
      sorted.map((i) => i.item),
      processor,
      { concurrency },
    );
  }

  /**
   * Create a work queue with producer-consumer pattern
   */
  static createWorkQueue<T, R>(options: {
    processor: (item: T) => Promise<R>;
    concurrency?: number;
    onResult?: (result: R) => void;
    onError?: (item: T, error: Error) => void;
  }) {
    const { processor, concurrency = 5, onResult, onError } = options;

    const queue: T[] = [];
    const processing = new Set<Promise<void>>();
    let isRunning = false;

    const processNext = () => {
      if (queue.length === 0 || processing.size >= concurrency) {
        return;
      }

      const item = queue.shift()!;

      const promise = (async () => {
        try {
          const result = await processor(item);
          if (onResult) {
            onResult(result);
          }
        } catch (error) {
          if (onError) {
            onError(item, error as Error);
          }
        }
      })();

      const promiseToProcess = promise;
      processing.add(promiseToProcess);

      void promiseToProcess.finally(() => {
        processing.delete(promiseToProcess);
        if (isRunning) {
          void processNext();
        }
      });

      void processNext(); // Start next item
    };

    return {
      /**
       * Add item to queue
       */
      add(item: T): void {
        queue.push(item);
        if (isRunning) {
          void processNext();
        }
      },

      /**
       * Add multiple items
       */
      addBatch(items: T[]): void {
        queue.push(...items);
        if (isRunning) {
          for (let i = 0; i < Math.min(concurrency, items.length); i++) {
            void processNext();
          }
        }
      },

      /**
       * Start processing
       */
      start(): void {
        isRunning = true;
        for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
          void processNext();
        }
      },

      /**
       * Stop processing (wait for current items to finish)
       */
      async stop(): Promise<void> {
        isRunning = false;
        await Promise.all(processing);
      },

      /**
       * Get queue status
       */
      getStatus() {
        return {
          queued: queue.length,
          processing: processing.size,
          isRunning,
        };
      },
    };
  }
}
