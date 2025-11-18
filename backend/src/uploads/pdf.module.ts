import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { DatabaseModule } from '../database/database.module';
import { ConfigModule } from '@nestjs/config';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [DatabaseModule, ConfigModule, JobsModule],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
