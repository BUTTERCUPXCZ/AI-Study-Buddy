import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Queue Monitoring Service
 * 
 * Provides real-time monitoring, metrics, and health checks for job queues.
 * Helps identify bottlenecks and optimize worker performance.
 */
@Injectable()
export class QueueMonitoringService {
  private readonly logger = new Logger(QueueMonitoringService.name);
  private metrics = new Map<string, QueueMetrics>();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(private readonly eventEmitter?: EventEmitter2) {}

  /**
   * Register a queue for monitoring
   */
  registerQueue(queueName: string, queue: Queue): void {
    this.logger.log(`Registering queue for monitoring: ${queueName}`);

    const queueEvents = new QueueEvents(queueName, {
      connection: queue.opts.connection,
    });

    // Initialize metrics
    this.metrics.set(queueName, {
      name: queueName,
      jobsProcessed: 0,
      jobsFailed: 0,
      totalProcessingTime: 0,
      avgProcessingTime: 0,
      minProcessingTime: Infinity,
      maxProcessingTime: 0,
      throughput: 0, // jobs per minute
      lastUpdate: Date.now(),
      healthStatus: 'healthy',
    });

    // Listen to queue events
    queueEvents.on('completed', async ({ jobId, returnvalue }) => {
      const job = await queue.getJob(jobId);
      if (job) {
        const processingTime = job.finishedOn! - job.processedOn!;
        this.updateMetrics(queueName, 'completed', processingTime);
      }
    });

    queueEvents.on('failed', async ({ jobId, failedReason }) => {
      this.updateMetrics(queueName, 'failed');
      this.logger.warn(`Job ${jobId} in ${queueName} failed: ${failedReason}`);
    });

    queueEvents.on('stalled', async ({ jobId }) => {
      this.logger.warn(`Job ${jobId} in ${queueName} stalled`);
      this.updateHealthStatus(queueName, 'degraded');
    });
  }

  /**
   * Update queue metrics
   */
  private updateMetrics(
    queueName: string,
    event: 'completed' | 'failed',
    processingTime?: number,
  ): void {
    const metrics = this.metrics.get(queueName);
    if (!metrics) return;

    if (event === 'completed' && processingTime) {
      metrics.jobsProcessed++;
      metrics.totalProcessingTime += processingTime;
      metrics.avgProcessingTime =
        metrics.totalProcessingTime / metrics.jobsProcessed;
      metrics.minProcessingTime = Math.min(
        metrics.minProcessingTime,
        processingTime,
      );
      metrics.maxProcessingTime = Math.max(
        metrics.maxProcessingTime,
        processingTime,
      );

      // Calculate throughput (jobs per minute)
      const elapsedMinutes = (Date.now() - metrics.lastUpdate) / 60000;
      metrics.throughput = metrics.jobsProcessed / Math.max(elapsedMinutes, 1);
    } else if (event === 'failed') {
      metrics.jobsFailed++;
    }

    this.metrics.set(queueName, metrics);

    // Emit metrics event
    if (this.eventEmitter) {
      this.eventEmitter.emit('queue.metrics.updated', {
        queueName,
        metrics,
      });
    }
  }

  /**
   * Update health status
   */
  private updateHealthStatus(
    queueName: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
  ): void {
    const metrics = this.metrics.get(queueName);
    if (metrics) {
      metrics.healthStatus = status;
      this.metrics.set(queueName, metrics);

      if (this.eventEmitter) {
        this.eventEmitter.emit('queue.health.changed', {
          queueName,
          status,
        });
      }
    }
  }

  /**
   * Get metrics for a specific queue
   */
  getQueueMetrics(queueName: string): QueueMetrics | undefined {
    return this.metrics.get(queueName);
  }

  /**
   * Get metrics for all queues
   */
  getAllMetrics(): QueueMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get detailed queue statistics
   */
  async getDetailedStats(queue: Queue): Promise<DetailedQueueStats> {
    const [
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      repeatableJobs,
    ] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
      queue.getRepeatableJobs(),
    ]);

    const metrics = this.metrics.get(queue.name);

    return {
      queueName: queue.name,
      counts: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      },
      isPaused: paused,
      repeatableJobsCount: repeatableJobs.length,
      metrics: metrics || null,
      recommendations: this.generateRecommendations(
        {
          waiting,
          active,
          completed,
          failed,
          delayed,
          total: waiting + active + completed + failed + delayed,
        },
        metrics,
      ),
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    counts: any,
    metrics?: QueueMetrics,
  ): string[] {
    const recommendations: string[] = [];

    // Check if queue is backed up
    if (counts.waiting > 100) {
      recommendations.push(
        `High number of waiting jobs (${counts.waiting}). Consider increasing worker concurrency.`,
      );
    }

    // Check if too many active jobs
    if (counts.active > 50) {
      recommendations.push(
        `High number of active jobs (${counts.active}). Monitor for memory issues.`,
      );
    }

    // Check failure rate
    if (counts.failed > 0) {
      const failureRate = counts.failed / counts.total;
      if (failureRate > 0.1) {
        recommendations.push(
          `High failure rate (${(failureRate * 100).toFixed(1)}%). Investigate error patterns.`,
        );
      }
    }

    // Check processing time
    if (metrics && metrics.avgProcessingTime > 30000) {
      recommendations.push(
        `Average processing time is high (${(metrics.avgProcessingTime / 1000).toFixed(1)}s). ` +
          'Consider optimizing worker logic or splitting jobs.',
      );
    }

    // Check throughput
    if (metrics && metrics.throughput < 1) {
      recommendations.push(
        `Low throughput (${metrics.throughput.toFixed(2)} jobs/min). ` +
          'Consider increasing concurrency or optimizing processing logic.',
      );
    }

    return recommendations;
  }

  /**
   * Start automatic health checks
   */
  startHealthChecks(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);

    this.logger.log(`Started health checks every ${intervalMs}ms`);
  }

  /**
   * Perform health check on all monitored queues
   */
  private async performHealthCheck(): Promise<void> {
    for (const [queueName, metrics] of this.metrics.entries()) {
      // Check if metrics haven't been updated recently
      const timeSinceLastUpdate = Date.now() - metrics.lastUpdate;
      if (timeSinceLastUpdate > 300000) {
        // 5 minutes
        this.updateHealthStatus(queueName, 'unhealthy');
        this.logger.warn(
          `Queue ${queueName} appears unhealthy - no updates for ${timeSinceLastUpdate}ms`,
        );
      } else if (metrics.jobsFailed > metrics.jobsProcessed * 0.2) {
        // More than 20% failures
        this.updateHealthStatus(queueName, 'degraded');
        this.logger.warn(
          `Queue ${queueName} has high failure rate: ${((metrics.jobsFailed / (metrics.jobsProcessed + metrics.jobsFailed)) * 100).toFixed(1)}%`,
        );
      } else {
        this.updateHealthStatus(queueName, 'healthy');
      }
    }
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.log('Stopped health checks');
    }
  }

  /**
   * Reset metrics for a queue
   */
  resetMetrics(queueName: string): void {
    const metrics = this.metrics.get(queueName);
    if (metrics) {
      metrics.jobsProcessed = 0;
      metrics.jobsFailed = 0;
      metrics.totalProcessingTime = 0;
      metrics.avgProcessingTime = 0;
      metrics.minProcessingTime = Infinity;
      metrics.maxProcessingTime = 0;
      metrics.throughput = 0;
      metrics.lastUpdate = Date.now();
      this.metrics.set(queueName, metrics);
    }
  }

  /**
   * Get performance report for all queues
   */
  getPerformanceReport(): PerformanceReport {
    const allMetrics = this.getAllMetrics();

    return {
      timestamp: new Date().toISOString(),
      totalQueues: allMetrics.length,
      totalJobsProcessed: allMetrics.reduce(
        (sum, m) => sum + m.jobsProcessed,
        0,
      ),
      totalJobsFailed: allMetrics.reduce((sum, m) => sum + m.jobsFailed, 0),
      avgThroughput: allMetrics.reduce((sum, m) => sum + m.throughput, 0),
      healthyQueues: allMetrics.filter(m => m.healthStatus === 'healthy')
        .length,
      degradedQueues: allMetrics.filter(m => m.healthStatus === 'degraded')
        .length,
      unhealthyQueues: allMetrics.filter(m => m.healthStatus === 'unhealthy')
        .length,
      queues: allMetrics,
    };
  }
}

// Type definitions
interface QueueMetrics {
  name: string;
  jobsProcessed: number;
  jobsFailed: number;
  totalProcessingTime: number;
  avgProcessingTime: number;
  minProcessingTime: number;
  maxProcessingTime: number;
  throughput: number;
  lastUpdate: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

interface DetailedQueueStats {
  queueName: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    total: number;
  };
  isPaused: boolean;
  repeatableJobsCount: number;
  metrics: QueueMetrics | null;
  recommendations: string[];
}

interface PerformanceReport {
  timestamp: string;
  totalQueues: number;
  totalJobsProcessed: number;
  totalJobsFailed: number;
  avgThroughput: number;
  healthyQueues: number;
  degradedQueues: number;
  unhealthyQueues: number;
  queues: QueueMetrics[];
}
