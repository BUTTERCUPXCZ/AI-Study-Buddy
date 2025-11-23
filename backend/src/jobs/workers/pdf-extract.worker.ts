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

@Processor('pdf-extract')
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
      await this.jobsService.updateJobStatus(job.id!, JobStatus.processing, {
        progress: 0,
      });
      await this.jobsService.setJobStage(job.id!, 'processing');
      this.wsGateway.emitJobUpdate(job.id!, 'processing', {
        fileId,
        userId,
        jobId: job.id!,
        progress: 0,
        message: 'Processing started',
      });

      // Step 1: Download/Load PDF from URL (10%)
      await job.updateProgress(10);
      await this.jobsService.setJobStage(job.id!, 'extracting');
      this.wsGateway.emitJobProgress(job.id!, 10, 'Downloading PDF');
      this.logger.log(`Downloading PDF from: ${fileUrl}`);

      // Step 2: Extract text from PDF (50%)
      await job.updateProgress(50);
      this.wsGateway.emitJobProgress(job.id!, 50, 'Extracting text');
      this.logger.log(`Extracting text from PDF...`);

      let text: string;
      let pageCount: number;

      try {
        // Try extracting from the URL first (signed URL)
        const result = await PdfParserUtil.extractTextFromUrl(fileUrl);
        text = result.text;
        pageCount = result.pageCount;
      } catch (urlError) {
        const urlErrorMessage =
          urlError instanceof Error ? urlError.message : 'Unknown error';
        this.logger.warn(
          `Failed to extract from URL: ${urlErrorMessage}, trying direct Supabase download...`,
        );

        // Fallback: Try downloading directly from Supabase storage
        // Extract the file path from the URL or use the stored path
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
          const filePath = fileRecord.url;

          this.logger.log(
            `Attempting direct download from Supabase storage: ${filePath}`,
          );

          const buffer = await PdfParserUtil.downloadFromSupabase(
            supabaseUrl!,
            supabaseKey!,
            'pdfs', // bucket name
            filePath,
          );

          const result = await PdfParserUtil.extractTextFromBuffer(buffer);
          text = result.text;
          pageCount = result.pageCount;

          this.logger.log(
            'Successfully extracted text using direct Supabase download',
          );
        } catch (supabaseError) {
          const supabaseErrorMessage =
            supabaseError instanceof Error
              ? supabaseError.message
              : 'Unknown error';
          this.logger.error(`Fallback also failed: ${supabaseErrorMessage}`);
          throw new Error(
            `Failed to extract PDF text: ${urlErrorMessage}. Fallback error: ${supabaseErrorMessage}`,
          );
        }
      }

      if (!text || text.trim().length === 0) {
        throw new Error('No text could be extracted from the PDF');
      }

      this.logger.log(
        `Extracted ${text.length} characters from ${pageCount} pages`,
      );

      // Step 3: Clean the extracted text (70%)
      await job.updateProgress(70);
      this.wsGateway.emitJobProgress(job.id!, 70, 'Cleaning extracted text');
      const cleanedText = PdfParserUtil.cleanText(text);

      // Step 4: Save to database (85%)
      await job.updateProgress(85);
      this.wsGateway.emitJobProgress(job.id!, 85, 'Saving extracted text');
      this.logger.log(`Saving extracted text to database...`);

      // Update the File record with extracted text
      // You may want to add an extractedText field to your File model
      // For now, we'll store it in a separate table or update the existing one

      // Option 1: Add extractedText field to File model (requires migration)
      // await this.databaseService.file.update({
      //   where: { id: fileId },
      //   data: { extractedText: cleanedText },
      // });

      // Option 2: Create a Note from the extracted text
      (await this.databaseService.note.create({
        data: {
          title: `Extracted from: ${fileName}`,
          content: cleanedText,
          source: fileId,
          userId: userId,
        },
      })) as Note;

      // Step 5: Queue AI Notes Generation (95%)
      await job.updateProgress(95);
      await this.jobsService.setJobStage(job.id!, 'generating_notes');
      this.wsGateway.emitJobUpdate(job.id!, 'generating_notes', {
        fileId,
        userId,
        jobId: job.id!,
        progress: 95,
        message: 'Generating notes',
      });
      this.logger.log('Queueing AI notes generation...');

      await this.aiNotesQueue.addAiNotesJob({
        extractedText: cleanedText,
        fileName,
        userId,
        fileId,
        pdfExtractJobId: job.id!,
      });

      // Complete (100%)
      await job.updateProgress(100);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `PDF extraction completed in ${processingTime}ms for job ${job.id}`,
      );

      // Update job status to completed and stage
      await this.jobsService.setJobStage(job.id!, 'completed');
      await this.jobsService.updateJobStatus(job.id!, JobStatus.completed, {
        progress: 100,
        finishedAt: new Date(),
      });
      await this.wsGateway.emitJobCompleted(job.id!, { fileId, userId });

      const result: PdfExtractJobResult = {
        fileId,
        extractedText: cleanedText.substring(0, 500), // Return first 500 chars
        pageCount,
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
      await this.jobsService.updateJobStatus(job.id!, JobStatus.failed, {
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
