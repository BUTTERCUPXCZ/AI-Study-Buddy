/**
 * Example Worker Implementation Using JobEventEmitter
 *
 * This is a reference implementation showing how to use the JobEventEmitter service
 * in your workers to emit standardized, consistent events.
 *
 * Key Patterns:
 * 1. Inject JobEventEmitterService in constructor
 * 2. Use JobStage enum for consistent stage naming
 * 3. Emit progress at regular intervals (every 10-15%)
 * 4. Always emit completed or failed events
 * 5. Include metadata for better UX
 * 6. Use try-catch to ensure errors are reported
 *
 * Copy this pattern to all your workers for consistency.
 */

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { JobEventEmitterService } from '../job-event-emitter.service';
import { JobStatus, JobStage } from '../dto/job-event.dto';

interface ExampleJobDto {
  fileId: string;
  fileName: string;
  userId: string;
}

interface ExampleJobResult {
  noteId: string;
  title: string;
  processingTimeMs: number;
}

@Processor('example-queue', {
  concurrency: 10,
  stalledInterval: 60000,
  maxStalledCount: 1,
  lockDuration: 60000,
  drainDelay: 30,
})
export class ExampleWorker extends WorkerHost {
  private readonly logger = new Logger(ExampleWorker.name);

  constructor(
    private readonly jobEventEmitter: JobEventEmitterService,
    // ... other dependencies
  ) {
    super();
  }

  async process(job: Job<ExampleJobDto>): Promise<ExampleJobResult> {
    const startTime = Date.now();
    const { fileId, fileName, userId } = job.data;

    this.logger.log(`Processing job ${job.id} for file: ${fileName}`);

    try {
      // ============ STAGE 1: INITIALIZE (5%) ============
      await this.jobEventEmitter.emitProgress({
        jobId: job.id!,
        userId,
        status: JobStatus.ACTIVE,
        stage: JobStage.INITIALIZING,
        progress: 5,
        message: `Starting processing for ${fileName}`,
        metadata: {
          fileName,
          fileId,
        },
        timestamp: new Date().toISOString(),
      });

      // Simulate initialization work
      await this.sleep(500);

      // ============ STAGE 2: DOWNLOAD (20%) ============
      await this.jobEventEmitter.emitProgress({
        jobId: job.id!,
        userId,
        status: JobStatus.ACTIVE,
        stage: JobStage.DOWNLOADING,
        progress: 20,
        message: 'Downloading file',
        timestamp: new Date().toISOString(),
      });

      const fileData = await this.downloadFile(fileId);

      // ============ STAGE 3: EXTRACT TEXT (40%) ============
      await this.jobEventEmitter.emitProgress({
        jobId: job.id!,
        userId,
        status: JobStatus.ACTIVE,
        stage: JobStage.EXTRACTING_TEXT,
        progress: 40,
        message: 'Extracting text from file',
        metadata: {
          fileSize: fileData.length,
        },
        timestamp: new Date().toISOString(),
      });

      const text = await this.extractText(fileData);

      // ============ STAGE 4: GENERATE NOTES (70%) ============
      await this.jobEventEmitter.emitProgress({
        jobId: job.id!,
        userId,
        status: JobStatus.ACTIVE,
        stage: JobStage.GENERATING_NOTES,
        progress: 70,
        message: 'Generating study notes with AI',
        metadata: {
          textLength: text.length,
        },
        timestamp: new Date().toISOString(),
      });

      const notes = await this.generateNotes(text);

      // ============ STAGE 5: SAVE (90%) ============
      await this.jobEventEmitter.emitProgress({
        jobId: job.id!,
        userId,
        status: JobStatus.ACTIVE,
        stage: JobStage.SAVING,
        progress: 90,
        message: 'Saving notes to database',
        timestamp: new Date().toISOString(),
      });

      const noteRecord = await this.saveNotes(notes, userId);

      // ============ STAGE 6: COMPLETE (100%) ============
      const processingTime = Date.now() - startTime;

      await this.jobEventEmitter.emitCompleted({
        jobId: job.id!,
        userId,
        status: JobStatus.COMPLETED,
        stage: JobStage.COMPLETED,
        progress: 100,
        result: {
          noteId: noteRecord.id,
          title: noteRecord.title,
          processingTimeMs: processingTime,
          cacheHit: false,
        },
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Job ${job.id} completed in ${processingTime}ms`);

      return {
        noteId: noteRecord.id,
        title: noteRecord.title,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      // ============ ERROR HANDLING ============
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Job ${job.id} failed: ${errorMessage}`);

      await this.jobEventEmitter.emitFailed({
        jobId: job.id!,
        userId,
        status: JobStatus.FAILED,
        stage: JobStage.FAILED,
        progress: 0,
        error: {
          message: errorMessage,
          code: 'PROCESSING_ERROR',
          recoverable: this.isRecoverableError(error),
        },
        timestamp: new Date().toISOString(),
      });

      // Re-throw for BullMQ retry logic
      throw error;
    }
  }

  // ============ HELPER METHODS ============

  private async downloadFile(fileId: string): Promise<Buffer> {
    // Implementation here - fileId would be used in real implementation
    await this.sleep(1000);
    return Buffer.from('mock data');
  }

  private async extractText(buffer: Buffer): Promise<string> {
    // Implementation here - buffer would be used in real implementation
    await this.sleep(1000);
    return 'Extracted text content';
  }

  private async generateNotes(text: string): Promise<string> {
    // Implementation here - text would be used in real implementation
    await this.sleep(2000);
    return '# Study Notes\n\nContent here...';
  }

  private async saveNotes(notes: string, userId: string): Promise<{ id: string; title: string }> {
    // Implementation here - notes and userId would be used in real implementation
    await this.sleep(500);
    return { id: 'note-123', title: 'Study Notes' };
  }

  private isRecoverableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Network errors, rate limits, etc. are recoverable
      return (
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('rate limit')
      );
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============ BULLMQ EVENT HANDLERS ============

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`✅ Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Job ${job.id} failed: ${error.message}`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`🚀 Job ${job.id} is now active`);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.debug(`📊 Job ${job.id} progress: ${progress}%`);
  }
}
