import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiService } from '../../ai/ai.service';
import { JobsService } from '../jobs.service';
import { AiQuizQueue } from '../queues/ai-quiz.queue';
import { JobsWebSocketGateway } from '../../websocket/websocket.gateway';
import { CreateAiNotesJobDto, AiNotesJobResult } from '../dto/ai-notes.dto';
import { JobStatus } from '@prisma/client';

@Processor('ai-notes')
export class AiNotesWorker extends WorkerHost {
  private readonly logger = new Logger(AiNotesWorker.name);

  constructor(
    private readonly aiService: AiService,
    private readonly jobsService: JobsService,
    private readonly aiQuizQueue: AiQuizQueue,
    private readonly wsGateway: JobsWebSocketGateway,
  ) {
    super();
  }

  async process(job: Job<CreateAiNotesJobDto>): Promise<AiNotesJobResult> {
    const startTime = Date.now();
    const { extractedText, fileName, userId, fileId, pdfExtractJobId } = job.data;

    this.logger.log(`Processing AI notes generation job ${job.id} for file: ${fileName}`);

    try {
      // Update job status to processing and set stage
      await this.jobsService.updateJobStatus(job.id!, JobStatus.processing, {
        progress: 0,
      });
      await this.jobsService.setJobStage(job.id!, 'processing');
      await this.wsGateway.emitJobUpdate(job.id!, 'processing', { fileId, userId });

  // Step 1: Validate extracted text (10%)
  await job.updateProgress(10);
  await this.wsGateway.emitJobProgress(job.id!, 10, 'Validating extracted text');
      if (!extractedText || extractedText.trim().length < 100) {
        throw new Error('Extracted text is too short to generate meaningful notes');
      }

      this.logger.log(`Processing ${extractedText.length} characters of text`);

  // Step 2: Generate structured notes using Gemini AI (60%)
  await job.updateProgress(30);
  await this.jobsService.setJobStage(job.id!, 'generating_notes');
  await this.wsGateway.emitJobUpdate(job.id!, 'generating_notes', { fileId, userId });
  this.logger.log('Calling Gemini AI to generate study notes...');

      const notesResult = await this.aiService.generateStructuredNotes(
        extractedText,
        fileName,
        userId,
        fileId,
      );

  await job.updateProgress(70);
  await this.wsGateway.emitJobProgress(job.id!, 70, 'Notes generated and saved');
  this.logger.log(`Notes generated and saved with ID: ${notesResult.noteId}`);

      // Step 3: Queue AI Quiz Generation (85%)
      await job.updateProgress(85);
      await this.jobsService.setJobStage(job.id!, 'generating_quiz');
      await this.wsGateway.emitJobUpdate(job.id!, 'generating_quiz', { noteId: notesResult.noteId, userId });
      this.logger.log('Queueing AI quiz generation...');

      await this.aiQuizQueue.addAiQuizJob({
        noteId: notesResult.noteId,
        noteContent: notesResult.content,
        noteTitle: notesResult.title,
        userId,
        aiNotesJobId: job.id!,
      });

      // Step 4: Complete (100%)
      await job.updateProgress(100);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `AI notes generation completed in ${processingTime}ms for job ${job.id}`,
      );

      // Update job status to completed and stage
      await this.jobsService.setJobStage(job.id!, 'completed');
      await this.jobsService.updateJobStatus(job.id!, JobStatus.completed, {
        progress: 100,
        finishedAt: new Date(),
      });
      await this.wsGateway.emitJobCompleted(job.id!, { noteId: notesResult.noteId, userId });

      const result: AiNotesJobResult = {
        noteId: notesResult.noteId,
        title: notesResult.title,
        contentLength: notesResult.content.length,
        processingTime,
        fileName,
      };

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process AI notes generation job ${job.id}: ${error.message}`,
      );

      // Update job status to failed
      await this.jobsService.updateJobStatus(job.id!, JobStatus.failed, {
        failedReason: error.message,
        failedAt: new Date(),
        attempts: job.attemptsMade,
      });

      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully - Notes generated`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} failed with error: ${error.message}`,
    );
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Job ${job.id} is now active - Generating notes with AI`);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.log(`Job ${job.id} progress: ${progress}%`);
  }
}
