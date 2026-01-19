import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { JobsService } from '../jobs.service';
import { AiNotesQueue } from '../queues/ai-notes.queue';
import { JobsWebSocketGateway } from '../../websocket/websocket.gateway';
import { PdfParserUtil } from '../utils/pdf-parser.util';
import {
  CreatePdfExtractJobDto,
  PdfExtractJobResult,
} from '../dto/pdf-extract.dto';
import { File, JobStatus } from '@prisma/client';

// CRITICAL: Configure worker to reduce Redis polling and avoid hitting Upstash request limits
@Processor('pdf-extract', {
  concurrency: 3, // Limit concurrent processing
  stalledInterval: 60000, // Check for stalled jobs every 60s instead of 30s
  maxStalledCount: 1, // Reduce stalled job checks
  lockDuration: 60000, // 60 seconds lock
  lockRenewTime: 30000, // Renew halfway through
  drainDelay: 60, // Long-poll Redis for 60s when idle to cut request volume
})
export class PdfExtractWorker extends WorkerHost {
  private readonly logger = new Logger(PdfExtractWorker.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly jobsService: JobsService,
    private readonly aiNotesQueue: AiNotesQueue,
    private readonly wsGateway: JobsWebSocketGateway,
  ) {
    super();
  }

  async process(
    job: Job<CreatePdfExtractJobDto>,
  ): Promise<PdfExtractJobResult> {
    const startTime = Date.now();
    const { fileId, fileUrl, fileName, userId } = job.data;

    this.logger.log(
      `Processing PDF extraction job ${job.id} for file: ${fileName}`,
    );

    try {
      // Update job status to processing and set stage
      await this.jobsService.updateJobStatus(
        job.id!,
        'processing' as JobStatus,
        {
          progress: 0,
        },
      );
      await this.jobsService.setJobStage(job.id!, 'processing');
      this.wsGateway.emitJobUpdate(job.id!, 'processing', {
        fileId,
        userId,
        jobId: job.id!,
        progress: 0,
        message: 'Processing started',
      });

      // Step 1: Download PDF (10%)
      await job.updateProgress(10);
      await this.jobsService.setJobStage(job.id!, 'downloading');
      this.wsGateway.emitJobProgress(job.id!, 10, 'Downloading PDF');
      this.logger.log(`Downloading PDF from: ${fileUrl}`);

      // Step 2: Download PDF as buffer (skip text extraction for faster processing)
      // Gemini AI will directly process the PDF
      await job.updateProgress(30);
      this.wsGateway.emitJobProgress(
        job.id!,
        30,
        'Preparing PDF for AI processing',
      );
      this.logger.log(`Downloading PDF buffer for direct AI processing...`);

      let pdfBuffer: Buffer;

      try {
        // Try downloading from the URL first (signed URL)
        pdfBuffer = await PdfParserUtil.downloadPdfFromUrl(fileUrl);
      } catch (urlError) {
        const urlErrorMessage =
          urlError instanceof Error ? urlError.message : 'Unknown error';
        this.logger.warn(
          `Failed to download from URL: ${urlErrorMessage}, trying direct Supabase download...`,
        );

        // Fallback: Try downloading directly from Supabase storage
        try {
          const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
          const supabaseKey = this.configService.get<string>(
            'SUPABASE_SERVICE_ROLE_KEY',
          );

          // Get the file record to retrieve the storage path
          const fileRecord = await this.databaseService.file.findUnique({
            where: { id: fileId },
          });

          if (!fileRecord) {
            throw new Error('File record not found in database');
          }

          // Use the stored path (which should be the storage path)
          const filePath: string = fileRecord.url;

          this.logger.log(
            `Attempting direct download from Supabase storage: ${filePath}`,
          );

          pdfBuffer = await PdfParserUtil.downloadFromSupabase(
            supabaseUrl!,
            supabaseKey!,
            'pdfs', // bucket name
            filePath,
          );

          this.logger.log(
            'Successfully downloaded PDF using direct Supabase download',
          );
        } catch (supabaseError) {
          const supabaseErrorMessage =
            supabaseError instanceof Error
              ? supabaseError.message
              : 'Unknown error';
          this.logger.error(`Fallback also failed: ${supabaseErrorMessage}`);
          throw new Error(
            `Failed to download PDF: ${urlErrorMessage}. Fallback error: ${supabaseErrorMessage}`,
          );
        }
      }

      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Downloaded PDF buffer is empty');
      }

      this.logger.log(
        `Downloaded PDF: ${(pdfBuffer.length / 1024).toFixed(2)} KB`,
      );

      // Step 3: Queue AI Notes Generation with PDF buffer (60%)
      // Skip text extraction - Gemini will directly process the PDF
      await job.updateProgress(60);
      await this.jobsService.setJobStage(job.id!, 'generating_notes');
      this.wsGateway.emitJobUpdate(job.id!, 'generating_notes', {
        fileId,
        userId,
        jobId: job.id!,
        progress: 60,
        message: 'Processing PDF with AI (direct mode)',
      });
      this.logger.log(
        'Queueing AI notes generation with direct PDF processing...',
      );

      // Convert buffer to base64 for job queue transport
      const pdfBase64 = pdfBuffer.toString('base64');

      await this.aiNotesQueue.addAiNotesJob({
        pdfBuffer: pdfBase64, // Pass PDF buffer instead of extracted text
        fileName,
        userId,
        fileId,
        pdfExtractJobId: job.id!,
        mimeType: 'application/pdf',
      });

      // Complete (100%)
      await job.updateProgress(100);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `PDF download completed in ${processingTime}ms for job ${job.id} - AI processing queued`,
      );

      // Update job status to completed and stage
      await this.jobsService.setJobStage(job.id!, 'completed');
      await this.jobsService.updateJobStatus(
        job.id!,
        'completed' as JobStatus,
        {
          progress: 100,
          finishedAt: new Date(),
        },
      );
      await this.wsGateway.emitJobCompleted(job.id!, { fileId, userId });

      const result: PdfExtractJobResult = {
        fileId,
        extractedText: '[PDF sent directly to AI for processing]',
        pageCount: 0, // Unknown without extraction
        fileName,
        processingTime,
      };

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to process PDF extraction job ${job.id}: ${errorMessage}`,
      );

      // Update job status to failed
      await this.jobsService.updateJobStatus(job.id!, 'failed' as JobStatus, {
        failedReason: errorMessage,
        failedAt: new Date(),
        attempts: job.attemptsMade,
      });

      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Job ${job.id} is now active`);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.log(`Job ${job.id} progress: ${progress}%`);
  }
}
