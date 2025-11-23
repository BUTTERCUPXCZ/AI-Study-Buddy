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
        `Adding PDF notes job for file: ${data.fileName} (${data.fileId})`,
      );

      // Generate a unique job ID using timestamp and random string
      const uniqueJobId = `pdf-notes-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Add job to BullMQ queue with custom job ID
      const job = await this.pdfNotesQueue.add(
        'generate-notes-from-pdf',
        {
          fileId: data.fileId,
          filePath: data.filePath,
          fileName: data.fileName,
          userId: data.userId,
        },
        {
          jobId: uniqueJobId, // Use custom unique job ID
          attempts: 3, // Retry up to 3 times
          backoff: {
            type: 'exponential',
            delay: 2000, // Start with 2 second delay
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 100, // Keep max 100 completed jobs
          },
          removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
          },
        },
      );

      this.logger.log(`Job added with ID: ${job.id}`);

      // Save job metadata to database
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
      this.logger.error(`Failed to add PDF notes job: ${errorMessage}`);
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
