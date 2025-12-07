import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePdfDto, UploadPdfResponseDto } from './dto/create-pdf.dto';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PdfNotesQueue } from '../jobs/queues/pdf-notes.queue';
import { PdfUltraOptimizedQueue } from '../jobs/queues/pdf-ultra-optimized.queue';

@Injectable()
export class PdfService {
  private supabase: SupabaseClient;
  private bucketName = 'pdfs'; // Change this to your bucket name

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly pdfNotesQueue: PdfNotesQueue,
    private readonly pdfUltraOptimizedQueue: PdfUltraOptimizedQueue,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    ) as unknown as SupabaseClient;
  }

  /**
   * Upload a PDF file to Supabase storage and save metadata to database
   * @param file - The uploaded file from multer
   * @param createPdfDto - DTO containing userId and fileName
   * @returns Upload response with file details
   */
  async uploadPdf(
    file: Express.Multer.File,
    createPdfDto: CreatePdfDto,
  ): Promise<UploadPdfResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type (PDFs only)
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    // Validate file size (e.g., max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    try {
      // Validate that the user exists in the database
      const userExists = await this.databaseService.user.findUnique({
        where: { id: createPdfDto.userId },
      });

      if (!userExists) {
        throw new BadRequestException(
          `User with ID ${createPdfDto.userId} does not exist. Please ensure you're using a valid user ID.`,
        );
      }

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedFileName = createPdfDto.fileName
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/\s+/g, '_');
      const uniqueFileName = `${createPdfDto.userId}/${timestamp}-${sanitizedFileName}`;

      // Upload to Supabase Storage
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

      // Save file metadata to database with the storage path
      const fileRecord = await this.databaseService.file.create({
        data: {
          name: createPdfDto.fileName,
          url: uploadData.path, // Store the storage path
          userId: createPdfDto.userId,
        },
      });

      // Queue PDF notes generation job (Gemini will read the PDF directly)
      const queueResult = await this.pdfNotesQueue.addPdfNotesJob({
        fileId: fileRecord.id,
        filePath: uploadData.path, // Pass storage path
        fileName: createPdfDto.fileName,
        userId: createPdfDto.userId,
      });

      // ALSO queue ULTRA-OPTIMIZED job for MAXIMUM performance
      // Features: connection pooling, multi-level cache, circuit breakers
      const ultraOptimizedResult = await this.pdfUltraOptimizedQueue.addPdfJob({
        fileId: fileRecord.id,
        filePath: uploadData.path,
        fileName: createPdfDto.fileName,
        userId: createPdfDto.userId,
      });

      return {
        id: fileRecord.id,
        url: fileRecord.url,
        name: fileRecord.name,
        userId: fileRecord.userId,
        message: 'File uploaded successfully and notes generation job queued',
        jobId: queueResult.jobId,
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
   * Get all files for a specific user
   * @param userId - The user ID to fetch files for
   * @returns Array of file records
   */
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
   * Get a single file by ID
   * @param id - The file ID
   * @returns File record
   */
  async getFileById(id: string): Promise<unknown> {
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

      return file;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to fetch file: ${errorMessage}`);
    }
  }

  /**
   * Delete a file from storage and database
   * @param id - The file ID
   * @param userId - The user ID (for authorization)
   * @returns Deletion confirmation
   */
  async deleteFile(id: string, userId: string) {
    try {
      // Find the file
      const file = await this.databaseService.file.findUnique({
        where: { id },
      });

      if (!file) {
        throw new NotFoundException(`File with ID ${id} not found`);
      }

      // Check if the user owns the file
      if (file.userId !== userId) {
        throw new BadRequestException(
          'You do not have permission to delete this file',
        );
      }

      // Delete from Supabase Storage
      const filePaths: string[] = [file.url];
      const { error: deleteError } = await this.supabase.storage
        .from(this.bucketName)
        .remove(filePaths);

      if (deleteError) {
        console.error('Failed to delete from storage:', deleteError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
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
