import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { PdfExtractQueue } from './queues/pdf-extract.queue';
import { PdfNotesQueue } from './queues/pdf-notes.queue';
import { AiNotesQueue } from './queues/ai-notes.queue';
import { AiQuizQueue } from './queues/ai-quiz.queue';
import { PdfExtractWorker } from './workers/pdf-extract.worker';

import { UltraOptimizedPdfWorker } from './workers/ultra-optimized-pdf.worker';
import { AiNotesWorker } from './workers/ai-notes.worker';
import { DatabaseModule } from '../database/database.module';
import { AiModule } from '../ai/ai.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { NotesModule } from '../notes/notes.module';
import { AuthModule } from '../auth/auth.module';
import { CompletionWorker } from './workers/completion.worker';
import { CompletionQueue } from './queues/completion.queue';
import { PdfNotesOptimizedQueue } from './queues/pdf-notes-optimized.queue';
import { PdfUltraOptimizedQueue } from './queues/pdf-ultra-optimized.queue';
import { JobEventEmitterService } from './job-event-emitter.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AiModule,
    WebsocketModule,
    NotesModule,
    AuthModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisHost =
          configService.get<string>('REDIS_HOST') || 'localhost';
        const redisPort = configService.get<number>('REDIS_PORT') || 6379;
        const redisPassword = configService.get<string>('REDIS_PASSWORD');
        const redisTls = configService.get<string>('REDIS_TLS');

        return {
          connection: {
            host: redisHost,
            port: redisPort,
            password: redisPassword,
            tls: redisTls === 'true' ? {} : undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            enableOfflineQueue: false,
            lazyConnect: true,
            retryStrategy: (times: number) => {
              if (times > 3) return null;
              return Math.min(times * 100, 3000);
            },
          },
          defaultJobOptions: {
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 86400, count: 5000 },
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      {
        name: 'pdf-extract',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      },
      {
        name: 'pdf-notes',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      },
      {
        name: 'pdf-notes-optimized',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { age: 3600, count: 1000 },
        },
      },
      {
        name: 'pdf-ultra-optimized',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { age: 3600, count: 1000 },
        },
      },
      {
        name: 'ai-notes',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
        },
      },
      {
        name: 'ai-quiz',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
        },
      },
      {
        name: 'completion',
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 1000 },
        },
      },
    ),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    JobEventEmitterService,
    PdfExtractQueue,
    PdfNotesQueue,
    PdfNotesOptimizedQueue,
    PdfUltraOptimizedQueue,
    AiNotesQueue,
    AiQuizQueue,
    CompletionQueue,
    PdfExtractWorker,
    UltraOptimizedPdfWorker,
    AiNotesWorker,
    CompletionWorker,
  ],
  exports: [
    JobsService,
    JobEventEmitterService,
    PdfExtractQueue,
    PdfNotesQueue,
    PdfNotesOptimizedQueue,
    PdfUltraOptimizedQueue,
    AiNotesQueue,
    AiQuizQueue,
    CompletionQueue,
  ],
})
export class JobsModule {}
