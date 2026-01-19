import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateAiNotesJobDto } from '../dto/ai-notes.dto';
import { JobsService } from '../jobs.service';

@Injectable()
export class AiNotesQueue {
  private readonly logger = new Logger(AiNotesQueue.name);

  constructor(
    @InjectQueue('ai-notes') private aiNotesQueue: Queue<CreateAiNotesJobDto>,
    private readonly jobsService: JobsService,
  ) {}

  /**
   * Add an AI notes generation job to the queue
   * Supports both direct PDF processing (faster) and extracted text (legacy)
   */
  async addAiNotesJob(data: CreateAiNotesJobDto) {
    try {
      const processingMode = data.pdfBuffer ? 'direct PDF' : 'extracted text';
      this.logger.log(
        `Adding AI notes generation job for file: ${data.fileName} (mode: ${processingMode})`,
      );

      // Add job to BullMQ queue
      const job = await this.aiNotesQueue.add(
        'generate-notes',
        {
          // Support both modes
          pdfBuffer: data.pdfBuffer,
          extractedText: data.extractedText,
          fileName: data.fileName,
          userId: data.userId,
          fileId: data.fileId,
          pdfExtractJobId: data.pdfExtractJobId,
          mimeType: data.mimeType || 'application/pdf',
        },
        {
          attempts: 3, // Retry up to 3 times
          backoff: {
            type: 'exponential',
            delay: 3000, // Start with 3 second delay (AI calls may take longer)
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 100,
          },
          removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
          },
        },
      );

      this.logger.log(`AI notes job added with ID: ${job.id}`);

      // Save job metadata to database
      await this.jobsService.createJobRecord({
        jobId: job.id!,
        name: 'generate-notes',
        queueName: 'ai-notes',
        data: {
          fileName: data.fileName,
          fileId: data.fileId,
          processingMode,
          dataSize: data.pdfBuffer
            ? `${(data.pdfBuffer.length / 1024).toFixed(2)} KB (PDF)`
            : `${data.extractedText?.length || 0} chars (text)`,
        },
        userId: data.userId,
        opts: job.opts,
      });

      return {
        jobId: job.id,
        message: 'AI notes generation job queued successfully',
        processingMode,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to add AI notes job: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get job status from BullMQ
   */
  async getJobStatus(jobId: string) {
    const job = await this.aiNotesQueue.getJob(jobId);

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
      this.aiNotesQueue.getWaitingCount(),
      this.aiNotesQueue.getActiveCount(),
      this.aiNotesQueue.getCompletedCount(),
      this.aiNotesQueue.getFailedCount(),
      this.aiNotesQueue.getDelayedCount(),
    ]);

    return {
      queue: 'ai-notes',
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
    await this.aiNotesQueue.pause();
    this.logger.log('AI notes queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue() {
    await this.aiNotesQueue.resume();
    this.logger.log('AI notes queue resumed');
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(grace: number = 3600000) {
    const cleaned = await this.aiNotesQueue.clean(grace, 100, 'completed');
    this.logger.log(
      `Cleaned ${cleaned.length} completed jobs from AI notes queue`,
    );
    return cleaned.length;
  }
}
