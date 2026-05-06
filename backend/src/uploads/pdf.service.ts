import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { CreatePdfDto, UploadPdfResponseDto } from './dto/create-pdf.dto';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PdfNotesQueue } from '../jobs/queues/pdf-notes.queue';
import { PdfUltraOptimizedQueue } from '../jobs/queues/pdf-ultra-optimized.queue';
import { AiService } from '../ai/ai.service';

const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

// If pdf-extract has more than this many waiting jobs, refuse new uploads
// with a Retry-After hint. Tunable via env. Prevents queue runaway during
// viral-spike or worker-outage scenarios.
const UPLOAD_BACKPRESSURE_THRESHOLD = Number(
  process.env.UPLOAD_BACKPRESSURE_THRESHOLD ?? 200,
);
const UPLOAD_BACKPRESSURE_RETRY_AFTER_S = 60;

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private supabase: SupabaseClient;
  private bucketName = 'pdfs';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly pdfNotesQueue: PdfNotesQueue,
    private readonly pdfUltraOptimizedQueue: PdfUltraOptimizedQueue,
    private readonly aiService: AiService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    ) as unknown as SupabaseClient;
  }

  /**
   * Upload a PDF file to Supabase storage and save metadata to database
   * @param file - The uploaded file from multer
   * @param userId - Authenticated user id (from AuthGuard)
   * @param createPdfDto - DTO containing fileName
   * @returns Upload response with file details
   */
  async uploadPdf(
    file: Express.Multer.File,
    userId: string,
    createPdfDto: CreatePdfDto,
  ): Promise<UploadPdfResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Backpressure: if downstream is already saturated, reject early so
    // the user sees a fast 503 + Retry-After instead of submitting work
    // that may not run for tens of minutes. Cheap check (a single Redis
    // ZCARD), runs before storage upload.
    try {
      const depth = await this.pdfUltraOptimizedQueue.getPendingDepth();
      if (depth >= UPLOAD_BACKPRESSURE_THRESHOLD) {
        this.logger.warn(
          `upload backpressure: depth=${depth} threshold=${UPLOAD_BACKPRESSURE_THRESHOLD}`,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message: 'System is busy generating notes. Try again in a minute.',
            retryAfter: UPLOAD_BACKPRESSURE_RETRY_AFTER_S,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    } catch (err) {
      // If the depth probe itself fails (Redis blip), fall through and
      // accept the upload. Better to let one through than to fail-closed.
      if (err instanceof HttpException) throw err;
      this.logger.warn(
        `backpressure probe failed: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // Verify magic bytes; defends against MIME spoofing
    if (
      !file.buffer ||
      file.buffer.length < 4 ||
      !file.buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)
    ) {
      throw new BadRequestException('File content is not a valid PDF');
    }

    try {
      const timestamp = Date.now();
      // S10 — strict filename sanitisation. The previous regex allowed
      // dots and dashes through, which could produce `.htaccess.pdf` (a
      // hidden file on some serving stacks) or `..pdf` (path-component
      // confusion). Reject anything outside [a-z0-9.-_], collapse the
      // dots, strip leading dots, and cap at 80 chars. Then assert the
      // final path contains no `..`, `/` or `\` before handing it to the
      // storage SDK — defence-in-depth against a future migration off
      // Supabase to a less strict provider.
      const sanitizedFileName = (() => {
        const lower = createPdfDto.fileName.toLowerCase();
        const slug = lower
          .replace(/[^a-z0-9.\-_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/\.{2,}/g, '.')
          .replace(/^\.+/, '')
          .slice(0, 80);
        return slug.length > 0 ? slug : 'file.pdf';
      })();
      const uniqueFileName = `${userId}/${timestamp}-${sanitizedFileName}`;
      if (
        uniqueFileName.includes('..') ||
        uniqueFileName.includes('\\') ||
        uniqueFileName.split('/').length !== 2
      ) {
        throw new BadRequestException('Invalid filename');
      }

      const { data: uploadData, error: uploadError } =
        await this.supabase.storage
          .from(this.bucketName)
          .upload(uniqueFileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

      if (uploadError) {
        throw new BadRequestException(`Upload failed: ${uploadError.message}`);
      }

      const fileRecord = await this.databaseService.file.create({
        data: {
          name: createPdfDto.fileName,
          url: uploadData.path,
          userId,
        },
      });

      // D1: previously the upload fanned out to BOTH pdfNotesQueue and
      // pdfUltraOptimizedQueue, doing the same Gemini work twice (and
      // double-billing it). The ultra-optimized path supersedes the
      // legacy one — pdfNotesQueue is kept as a provider for now in case
      // any external integration still references it, but new uploads
      // only enqueue here.
      const ultraOptimizedResult = await this.pdfUltraOptimizedQueue.addPdfJob({
        fileId: fileRecord.id,
        filePath: uploadData.path,
        fileName: createPdfDto.fileName,
        userId,
      });

      return {
        id: fileRecord.id,
        url: fileRecord.url,
        name: fileRecord.name,
        userId: fileRecord.userId,
        message: 'File uploaded successfully and notes generation job queued',
        jobId: ultraOptimizedResult.jobId,
        ultraOptimizedJobId: ultraOptimizedResult.jobId,
        deduplicated: ultraOptimizedResult.deduplicated,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to upload file: ${errorMessage}`);
    }
  }

  /**
   * Synchronous, ChatGPT-style PDF → notes pipeline.
   *
   * Validates the PDF, saves the binary to Supabase + a File row, then
   * pipes Gemini's streaming response straight back to the browser as
   * Server-Sent Events. The Note row is written when the stream
   * finishes. No BullMQ queue, no WebSocket, no polling — the user
   * watches the notes type in over a single open HTTP response.
   *
   * Trade-off: if the user closes the tab mid-stream, the worker stops
   * and the Note isn't saved. That matches ChatGPT's UX. Users who want
   * durable retries can still hit the legacy POST /upload (queued path).
   */
  async uploadAndStreamNotes(
    file: Express.Multer.File,
    userId: string,
    createPdfDto: CreatePdfDto,
    res: Response,
  ): Promise<void> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    if (
      !file.buffer ||
      file.buffer.length < 4 ||
      !file.buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)
    ) {
      throw new BadRequestException('File content is not a valid PDF');
    }

    const timestamp = Date.now();
    const sanitizedFileName = (() => {
      const lower = createPdfDto.fileName.toLowerCase();
      const slug = lower
        .replace(/[^a-z0-9.\-_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/\.{2,}/g, '.')
        .replace(/^\.+/, '')
        .slice(0, 80);
      return slug.length > 0 ? slug : 'file.pdf';
    })();
    const uniqueFileName = `${userId}/${timestamp}-${sanitizedFileName}`;
    if (
      uniqueFileName.includes('..') ||
      uniqueFileName.includes('\\') ||
      uniqueFileName.split('/').length !== 2
    ) {
      throw new BadRequestException('Invalid filename');
    }

    // Save to Supabase + DB BEFORE opening the stream so any storage
    // failure surfaces as a clean 4xx, not a half-written SSE frame.
    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from(this.bucketName)
      .upload(uniqueFileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }

    const fileRecord = await this.databaseService.file.create({
      data: {
        name: createPdfDto.fileName,
        url: uploadData.path,
        userId,
      },
    });

    // Now flip into SSE mode. Once the first byte goes out, the response
    // is committed — any error from here on becomes a stream `error`
    // event, not an HTTP status.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const writeEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    writeEvent({
      type: 'meta',
      fileId: fileRecord.id,
      fileName: fileRecord.name,
    });

    try {
      const result = await this.aiService.generateNotesFromPDFStream(
        file.buffer,
        createPdfDto.fileName,
        userId,
        fileRecord.id,
        (_chunk, accumulated) => {
          // Send accumulated text on every chunk — frontend renders the
          // whole buffer each tick (cheap for <50KB notes) and never
          // has to handle out-of-order or missing chunks.
          writeEvent({ type: 'chunk', accumulated });
        },
        'application/pdf',
      );

      writeEvent({
        type: 'done',
        noteId: result.noteId,
        title: result.title,
        fileId: fileRecord.id,
      });
    } catch (err) {
      this.logger.error(
        `[uploadAndStreamNotes] generation failed: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      writeEvent({
        type: 'error',
        message: err instanceof Error ? err.message : 'Generation failed',
      });
    } finally {
      res.end();
    }
  }

  async getUserFiles(userId: string): Promise<unknown> {
    try {
      const files = await this.databaseService.file.findMany({
        where: { userId },
        orderBy: { id: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              Fullname: true,
              email: true,
            },
          },
        },
      });

      return files;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to fetch files: ${errorMessage}`);
    }
  }

  /**
   * Get a single file by ID — only if owned by the requesting user
   */
  async getFileById(id: string, userId: string): Promise<unknown> {
    try {
      const file = await this.databaseService.file.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              Fullname: true,
              email: true,
            },
          },
        },
      });

      if (!file) {
        throw new NotFoundException(`File with ID ${id} not found`);
      }

      if (file.userId !== userId) {
        throw new ForbiddenException(
          'You do not have permission to access this file',
        );
      }

      return file;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to fetch file: ${errorMessage}`);
    }
  }

  async deleteFile(id: string, userId: string) {
    try {
      const file = await this.databaseService.file.findUnique({
        where: { id },
      });

      if (!file) {
        throw new NotFoundException(`File with ID ${id} not found`);
      }

      if (file.userId !== userId) {
        throw new ForbiddenException(
          'You do not have permission to delete this file',
        );
      }

      const filePaths: string[] = [file.url];
      const { error: deleteError } = await this.supabase.storage
        .from(this.bucketName)
        .remove(filePaths);

      if (deleteError) {
        // Continue with database deletion even if storage deletion fails
      }

      await this.databaseService.file.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'File deleted successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to delete file: ${errorMessage}`);
    }
  }
}
