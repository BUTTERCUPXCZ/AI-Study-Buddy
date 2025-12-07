import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JobsService } from '../jobs.service';
import { JobsWebSocketGateway } from '../../websocket/websocket.gateway';
import { JobStatus } from '@prisma/client';

// CRITICAL: Configure worker to reduce Redis polling and avoid hitting Upstash request limits
@Processor('completion', {
  concurrency: 5, // Can handle more since these are lightweight
  stalledInterval: 60000, // Check for stalled jobs every 60s instead of 30s
  maxStalledCount: 1, // Reduce stalled job checks
  lockDuration: 60000, // 60 seconds lock
  lockRenewTime: 30000, // Renew halfway through
  drainDelay: 60, // Long-poll Redis for 60s when idle to cut request volume
})
export class CompletionWorker extends WorkerHost {
  private readonly logger = new Logger(CompletionWorker.name);

  constructor(
    private readonly jobsService: JobsService,
    private readonly wsGateway: JobsWebSocketGateway,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string; userId: string; result: unknown }>) {
    const { jobId, userId, result } = job.data;

    try {
      this.logger.log(`Finalizing job lifecycle for ${jobId}`);

      // Use upsert to ensure record exists before updating
      await this.jobsService.upsertJobStatus(jobId, 'completed' as JobStatus, {
        progress: 100,
        finishedAt: new Date(),
        userId: userId,
      });

      // Set final stage
      await this.jobsService
        .setJobStage(jobId, 'completed')
        .catch((err: Error) => {
          this.logger.warn(
            `Failed to set stage for job ${jobId}: ${err.message}`,
          );
        });

      // Emit websocket completion
      await this.wsGateway.emitJobCompleted(
        jobId,
        result || { message: 'Job completed' },
      );

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Completion worker failed for ${jobId}: ${errorMessage}`,
      );
      await this.jobsService.upsertJobStatus(jobId, 'failed' as JobStatus, {
        failedReason: errorMessage,
        failedAt: new Date(),
        attempts: job.attemptsMade,
        userId: userId,
      });
      await this.wsGateway.emitJobError(jobId, error);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Completion job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Completion job ${job.id} failed: ${err.message}`);
  }
}
