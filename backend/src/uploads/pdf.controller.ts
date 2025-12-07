import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PdfService } from './pdf.service';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { Throttle } from '../common/decorators/throttle.decorator';

@Controller('upload')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  /**
   * Upload a PDF file
   * POST /upload
   * Content-Type: multipart/form-data
   * Required fields: file (PDF file), userId, fileName
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @Throttle(10, 60) // 10 uploads per minute
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body() createPdfDto: CreatePdfDto,
  ): Promise<unknown> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return await this.pdfService.uploadPdf(file, createPdfDto);
  }

  /**
   * Get all files for a user
   * GET /upload/user/:userId
   */
  @Get('user/:userId')
  async getUserFiles(@Param('userId') userId: string): Promise<unknown> {
    return await this.pdfService.getUserFiles(userId);
  }

  /**
   * Get a single file by ID
   * GET /upload/:id
   */
  @Get(':id')
  async getFile(@Param('id') id: string) {
    return await this.pdfService.getFileById(id);
  }

  /**
   * Delete a file
   * DELETE /upload/:id
   */
  @Delete(':id')
  async deleteFile(@Param('id') id: string, @Query('userId') userId: string) {
    return await this.pdfService.deleteFile(id, userId);
  }
}
