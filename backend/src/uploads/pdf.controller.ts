import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
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
import { UpdatePdfDto } from './dto/update-pdf.dto';

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
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body() createPdfDto: CreatePdfDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return await this.pdfService.uploadPdf(file, createPdfDto);
  }
}
