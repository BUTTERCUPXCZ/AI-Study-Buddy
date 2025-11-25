import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JobsService } from '../jobs.service';

export interface CreatePdfNotesJobDto {
  fileId: string;
  filePath: string; // Storage path in Supabase
  fileName: string;
  userId: string;
}

@Injectable()
export class PdfNotesQueue {
  private readonly logger = new Logger(PdfNotesQueue.name);

  constructor(
    @InjectQueue('pdf-notes')
    private pdfNotesQueue: Queue<CreatePdfNotesJobDto>,
    private readonly jobsService: JobsService,
  ) {}

  /**
   * Add a PDF notes generation job to the queue
   * This is called when a PDF is uploaded
   */
  async addPdfNotesJob(data: CreatePdfNotesJobDto) {
    try {
      this.logger.log(
        `[QUEUE] Adding PDF notes job: ${data.fileName} (${data.fileId})`,
      );

      // Generate a unique job ID using timestamp and random string
      const uniqueJobId = `pdf-notes-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Add job to BullMQ queue with optimized settings
      const job = await this.pdfNotesQueue.add(
        'generate-notes-from-pdf',
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
            age: 3600,
            count: 100,
          },
          removeOnFail: {
            age: 86400,
          },
          // Optimize for faster processing
          priority: 1, // High priority
        },
      );

      this.logger.log(`[QUEUE] Job queued: ${job.id}`);

      // Save job metadata to database (non-blocking)
      await this.jobsService.createJobRecord({
        jobId: job.id!,
        name: 'generate-notes-from-pdf',
        queueName: 'pdf-notes',
        data: data,
        userId: data.userId,
        opts: job.opts,
      });

      return {
        jobId: job.id,
        message: 'PDF notes generation job queued successfully',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[QUEUE ERROR] Failed to add job: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get job status from BullMQ
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
      queue: 'pdf-notes',
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
    this.logger.log('PDF notes queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue() {
    await this.pdfNotesQueue.resume();
    this.logger.log('PDF notes queue resumed');
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(grace: number = 3600000) {
    const cleaned = await this.pdfNotesQueue.clean(grace, 100, 'completed');
    this.logger.log(`Cleaned ${cleaned.length} completed jobs from queue`);
    return cleaned.length;
  }
}
