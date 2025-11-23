import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { JobsService } from '../jobs.service';
import { AiService } from '../../ai/ai.service';
import { JobsWebSocketGateway } from '../../websocket/websocket.gateway';
import { JobStatus } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface CreatePdfNotesJobDto {
  fileId: string;
  filePath: string; // Storage path in Supabase
  fileName: string;
  userId: string;
}

export interface PdfNotesJobResult {
  noteId: string;
  title: string;
  fileName: string;
  processingTime: number;
}

@Processor('pdf-notes')
export class PdfNotesWorker extends WorkerHost {
  private readonly logger = new Logger(PdfNotesWorker.name);
  private supabase: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly jobsService: JobsService,
    private readonly aiService: AiService,
    private readonly wsGateway: JobsWebSocketGateway,
  ) {
    super();

    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    ) as unknown as SupabaseClient;
  }

  async process(job: Job<CreatePdfNotesJobDto>): Promise<PdfNotesJobResult> {
    const startTime = Date.now();
    const { fileId, filePath, fileName, userId } = job.data;

    this.logger.log(
      `Processing PDF notes generation job ${job.id} for file: ${fileName}`,
    );

    try {
      // Set initial status
      await this.jobsService.updateJobStatus(
        job.id!,
        JobStatus.processing as JobStatus,
        {
          progress: 0,
        },
      );
      await this.jobsService.setJobStage(job.id!, 'processing');
      this.wsGateway.emitJobUpdate(job.id!, 'processing', {
        jobId: job.id!,
        userId,
        progress: 10,
        message: 'Processing PDF...',
      });

      // Step 1: Download PDF (20%)
      await job.updateProgress(20);
      await this.jobsService.setJobStage(job.id!, 'downloading');
      this.wsGateway.emitJobProgress(
        job.id!,
        20,
        'Downloading PDF from storage',
      );

      this.logger.log(`Downloading PDF from Supabase: ${filePath}`);
      const { data: pdfData, error: downloadError } =
        await this.supabase.storage.from('pdfs').download(filePath);

      if (downloadError || !pdfData) {
        throw new Error(
          `Failed to download PDF: ${downloadError?.message || 'Unknown error'}`,
        );
      }

      const arrayBuffer = await pdfData.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);
      this.logger.log(`Downloaded ${pdfBuffer.length} bytes`);

      // Step 2: Send PDF to Gemini for analysis (40%)
      await job.updateProgress(40);
      await this.jobsService.setJobStage(job.id!, 'generating_notes');
      this.wsGateway.emitJobProgress(job.id!, 40, 'Analyzing PDF with AI');

      this.logger.log('Sending PDF to Gemini for note generation...');
      const notesResult = await this.aiService.generateNotesFromPDF(
        pdfBuffer,
        fileName,
        userId,
        fileId,
        'application/pdf',
      );

      // Step 3: Notes generated (90%)
      await job.updateProgress(90);
      this.wsGateway.emitJobProgress(
        job.id!,
        90,
        'Notes generated successfully',
      );
      this.logger.log(
        `Notes generated and saved with ID: ${notesResult.noteId}`,
      );

      // Step 4: Complete (100%)
      await job.updateProgress(100);
      await this.jobsService.setJobStage(job.id!, 'completed');
      await this.jobsService.updateJobStatus(job.id!, JobStatus.completed, {
        progress: 100,
        finishedAt: new Date(),
      });

      // Emit final progress with status 'completed'
      this.wsGateway.emitJobProgress(
        job.id!,
        100,
        'Notes generation completed',
      );
      await this.wsGateway.emitJobCompleted(job.id!, {
        status: 'completed',
        noteId: notesResult.noteId,
        fileId,
        userId,
      });

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `PDF notes generation completed in ${processingTime}ms for job ${job.id}`,
      );

      return {
        noteId: notesResult.noteId,
        title: notesResult.title,
        fileName,
        processingTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to process PDF notes job ${job.id}: ${errorMessage}`,
      );

      // Update job status to failed
      await this.jobsService.updateJobStatus(job.id!, JobStatus.failed, {
        failedReason: errorMessage,
        failedAt: new Date(),
        attempts: job.attemptsMade,
      });

      this.wsGateway.emitJobProgress(job.id!, 100, 'Processing failed');

      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(
      `Job ${job.id} completed successfully - Notes generated from PDF`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Job ${job.id} is now active - Processing PDF with Gemini`);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.log(`Job ${job.id} progress: ${progress}%`);
  }
}
