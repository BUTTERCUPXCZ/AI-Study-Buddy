import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreatePdfExtractJobDto } from '../dto/pdf-extract.dto';
import { JobsService } from '../jobs.service';

@Injectable()
export class PdfExtractQueue {
  private readonly logger = new Logger(PdfExtractQueue.name);

  constructor(
    @InjectQueue('pdf-extract') private pdfExtractQueue: Queue,
    private readonly jobsService: JobsService,
  ) {}

  /**
   * Add a PDF extraction job to the queue
   * This is called when a PDF is uploaded
   */
  async addPdfExtractJob(data: CreatePdfExtractJobDto) {
    try {
      this.logger.log(
        `Adding PDF extract job for file: ${data.fileName} (${data.fileId})`,
      );

      // Add job to BullMQ queue
      const job = await this.pdfExtractQueue.add(
        'extract-pdf',
        {
          fileId: data.fileId,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          userId: data.userId,
        },
        {
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
        name: 'extract-pdf',
        queueName: 'pdf-extract',
        data: data,
        userId: data.userId,
        opts: job.opts,
      });

      return {
        jobId: job.id,
        message: 'PDF extraction job queued successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to add PDF extract job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get job status from BullMQ
   */
  async getJobStatus(jobId: string) {
    const job = await this.pdfExtractQueue.getJob(jobId);
    
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
      this.pdfExtractQueue.getWaitingCount(),
      this.pdfExtractQueue.getActiveCount(),
      this.pdfExtractQueue.getCompletedCount(),
      this.pdfExtractQueue.getFailedCount(),
      this.pdfExtractQueue.getDelayedCount(),
    ]);

    return {
      queue: 'pdf-extract',
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
    await this.pdfExtractQueue.pause();
    this.logger.log('PDF extract queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue() {
    await this.pdfExtractQueue.resume();
    this.logger.log('PDF extract queue resumed');
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(grace: number = 3600000) {
    const cleaned = await this.pdfExtractQueue.clean(grace, 100, 'completed');
    this.logger.log(`Cleaned ${cleaned.length} completed jobs from queue`);
    return cleaned.length;
  }
}
