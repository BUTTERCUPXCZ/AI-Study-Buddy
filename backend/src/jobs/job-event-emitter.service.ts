import { Injectable, Logger } from '@nestjs/common';
import { JobsWebSocketGateway } from '../websocket/websocket.gateway';
import { JobsService } from './jobs.service';
import {
  JobEventPayload,
  JobCompletedPayload,
  JobFailedPayload,
  JobProgressPayload,
  JobStatus,
} from './dto/job-event.dto';
import { JobStatus as PrismaJobStatus } from '@prisma/client';

/**
 * JobEventEmitterService
 * 
 * Centralized service for emitting job events across the applica
 * tion.
 * Ensures consistent event format, handles multiple destinations (WebSocket, DB, cache),
 * and provides error handling for event emission failures.
 * 
 * Benefits:
 * - Single source of truth for event emission
 * - Consistent event structure across all workers
 * - Automatic persistence to database
 * - WebSocket broadcasting with room targeting
 * - Non-blocking async operations
 * - Comprehensive error handling
 * 
 * Usage:
 * ```typescript
 * await this.jobEventEmitter.emitProgress({
 *   jobId: job.id!,
 *   userId: job.data.userId,
 *   status: JobStatus.ACTIVE,
 *   stage: JobStage.DOWNLOADING,
 *   progress: 20,
 *   message: 'Downloading PDF from storage',
 * });
 * ```
 */
@Injectable()
export class JobEventEmitterService {
  private readonly logger = new Logger(JobEventEmitterService.name);

  constructor(
    private readonly wsGateway: JobsWebSocketGateway,
    private readonly jobsService: JobsService,
  ) {}

  /**
   * Emit job progress update
   * 
   * Broadcasts progress to WebSocket clients and updates database.
   * Database updates are async and non-blocking to avoid slowing down workers.
   * 
   * @param payload - Job progress payload
   */
  async emitProgress(payload: JobProgressPayload): Promise<void> {
    try {
      // Validate payload
      this.validatePayload(payload);

      // Ensure timestamp is set
      if (!payload.timestamp) {
        payload.timestamp = new Date().toISOString();
      }

      this.logger.debug(
        `[Job ${payload.jobId}] Progress: ${payload.progress}% - ${payload.stage}`,
      );

      // Emit to WebSocket (synchronous for immediate delivery)
      this.wsGateway.emitJobProgress(
        payload.jobId,
        payload.progress,
        payload.stage,
        payload.userId,
      );

      // Update database (async, non-blocking)
      this.updateJobInDatabase(payload).catch((err) =>
        this.logger.error(
          `Failed to update database for job ${payload.jobId}: ${err.message}`,
        ),
      );

      // Update stage in opts (async, non-blocking)
      this.jobsService
        .setJobStage(payload.jobId, payload.stage)
        .catch((err) =>
          this.logger.warn(
            `Failed to set stage for job ${payload.jobId}: ${err.message}`,
          ),
        );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to emit progress for job ${payload.jobId}: ${errorMessage}`,
      );
      // Don't throw - event emission failures shouldn't stop job processing
    }
  }

  /**
   * Emit job completed event
   * 
   * Broadcasts completion to WebSocket clients and marks job as completed in database.
   * Includes final result data (noteId, processingTime, etc.)
   * 
   * @param payload - Job completed payload
   */
  async emitCompleted(payload: JobCompletedPayload): Promise<void> {
    try {
      this.validatePayload(payload);

      if (!payload.timestamp) {
        payload.timestamp = new Date().toISOString();
      }

      this.logger.log(
        `[Job ${payload.jobId}] Completed in ${payload.result.processingTimeMs}ms (Cache hit: ${payload.result.cacheHit})`,
      );

      // Emit to WebSocket
      await this.wsGateway.emitJobCompleted(payload.jobId, {
        ...payload.result,
        userId: payload.userId,
        jobId: payload.jobId,
      });

      // Update database
      await this.jobsService.updateJobStatus(
        payload.jobId,
        'completed' as PrismaJobStatus,
        {
          progress: 100,
          finishedAt: new Date(),
        },
      );

      // Set final stage
      await this.jobsService
        .setJobStage(payload.jobId, payload.stage)
        .catch((err) =>
          this.logger.warn(
            `Failed to set final stage for job ${payload.jobId}: ${err.message}`,
          ),
        );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to emit completion for job ${payload.jobId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Emit job failed event
   * 
   * Broadcasts failure to WebSocket clients and marks job as failed in database.
   * Includes error details and whether the job is recoverable/retryable.
   * 
   * @param payload - Job failed payload
   */
  async emitFailed(payload: JobFailedPayload): Promise<void> {
    try {
      this.validatePayload(payload);

      if (!payload.timestamp) {
        payload.timestamp = new Date().toISOString();
      }

      this.logger.error(
        `[Job ${payload.jobId}] Failed: ${payload.error.message} (Code: ${payload.error.code}, Recoverable: ${payload.error.recoverable})`,
      );

      // Emit to WebSocket
      await this.wsGateway.emitJobError(payload.jobId, {
        message: payload.error.message,
        code: payload.error.code,
        userId: payload.userId,
      });

      // Update database
      await this.jobsService.updateJobStatus(
        payload.jobId,
        'failed' as PrismaJobStatus,
        {
          failedReason: payload.error.message,
          failedAt: new Date(),
        },
      );

      // Set final stage
      await this.jobsService
        .setJobStage(payload.jobId, payload.stage)
        .catch((err) =>
          this.logger.warn(
            `Failed to set failed stage for job ${payload.jobId}: ${err.message}`,
          ),
        );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to emit failure for job ${payload.jobId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Emit job queued event
   * 
   * Called when a job is first added to the queue.
   * Useful for tracking jobs from the very beginning.
   * 
   * @param payload - Job event payload with QUEUED status
   */
  async emitQueued(payload: JobEventPayload): Promise<void> {
    try {
      this.validatePayload(payload);

      if (!payload.timestamp) {
        payload.timestamp = new Date().toISOString();
      }

      this.logger.log(`[Job ${payload.jobId}] Queued`);

      // Emit to WebSocket
      this.wsGateway.emitJobProgress(
        payload.jobId,
        0,
        payload.stage,
        payload.userId,
      );

      // Update database (async)
      this.updateJobInDatabase(payload).catch((err) =>
        this.logger.error(
          `Failed to update database for queued job ${payload.jobId}: ${err.message}`,
        ),
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to emit queued event for job ${payload.jobId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Update job record in database
   * Private helper method for consistent database updates
   */
  private async updateJobInDatabase(payload: JobEventPayload): Promise<void> {
    const prismaStatus = this.mapJobStatusToPrisma(payload.status);

    await this.jobsService.upsertJobStatus(payload.jobId, prismaStatus, {
      progress: payload.progress,
      userId: payload.userId,
    });
  }

  /**
   * Map DTO JobStatus to Prisma JobStatus
   */
  private mapJobStatusToPrisma(status: JobStatus): PrismaJobStatus {
    const statusMap: Record<JobStatus, PrismaJobStatus> = {
      [JobStatus.QUEUED]: 'queued' as PrismaJobStatus,
      [JobStatus.ACTIVE]: 'processing' as PrismaJobStatus,
      [JobStatus.COMPLETED]: 'completed' as PrismaJobStatus,
      [JobStatus.FAILED]: 'failed' as PrismaJobStatus,
      [JobStatus.STALLED]: 'failed' as PrismaJobStatus, // Treat stalled as failed
    };

    return statusMap[status];
  }

  /**
   * Validate event payload
   * Ensures required fields are present and valid
   */
  private validatePayload(payload: JobEventPayload): void {
    if (!payload.jobId) {
      throw new Error('jobId is required');
    }

    if (!payload.userId) {
      throw new Error('userId is required');
    }

    if (
      typeof payload.progress !== 'number' ||
      payload.progress < 0 ||
      payload.progress > 100
    ) {
      throw new Error('progress must be a number between 0 and 100');
    }

    if (!payload.status) {
      throw new Error('status is required');
    }

    if (!payload.stage) {
      throw new Error('stage is required');
    }
  }

  /**
   * Emit batch progress updates
   * Useful when you need to emit multiple progress updates in quick succession
   * 
   * @param payloads - Array of progress payloads
   */
  async emitBatchProgress(payloads: JobProgressPayload[]): Promise<void> {
    await Promise.allSettled(payloads.map((payload) => this.emitProgress(payload)));
  }
}
