import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { PdfService } from './pdf.service';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { Throttle } from '../common/decorators/throttle.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('upload')
@UseGuards(AuthGuard, EmailVerifiedGuard)
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @Throttle(10, 60)
  async uploadPdf(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() createPdfDto: CreatePdfDto,
  ): Promise<unknown> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return await this.pdfService.uploadPdf(file, userId, createPdfDto);
  }

  /**
   * ChatGPT-style synchronous endpoint: upload a PDF, the response is
   * a Server-Sent Event stream that pipes Gemini's tokens straight back
   * to the browser. Saves the Note when the stream ends.
   */
  @Post('stream')
  @UseInterceptors(FileInterceptor('file'))
  @Throttle(10, 60)
  async uploadAndStreamNotes(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() createPdfDto: CreatePdfDto,
    @Res() res: Response,
  ): Promise<void> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    await this.pdfService.uploadAndStreamNotes(file, userId, createPdfDto, res);
  }

  @Get()
  async getUserFiles(@CurrentUser('id') userId: string): Promise<unknown> {
    return await this.pdfService.getUserFiles(userId);
  }

  @Get(':id')
  async getFile(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return await this.pdfService.getFileById(id, userId);
  }

  @Delete(':id')
  async deleteFile(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return await this.pdfService.deleteFile(id, userId);
  }
}
