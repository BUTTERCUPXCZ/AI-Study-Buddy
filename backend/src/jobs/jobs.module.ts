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
import { PdfNotesOptimizedWorker } from './workers/pdf-notes-optimized.worker';
import { UltraOptimizedPdfWorker } from './workers/ultra-optimized-pdf.worker';
import { AiNotesWorker } from './workers/ai-notes.worker';
import { DatabaseModule } from '../database/database.module';
import { AiModule } from '../ai/ai.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { NotesModule } from '../notes/notes.module';
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
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // BullMQ requires a standard Redis connection (not Upstash REST API)
        // You'll need to add REDIS_HOST, REDIS_PORT, REDIS_PASSWORD to your .env
        // For Upstash, use their Redis TCP endpoint
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
            // For Upstash with TLS
            tls: redisTls === 'true' ? {} : undefined,
            // BullMQ requires maxRetriesPerRequest to be null
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            enableOfflineQueue: false,
            lazyConnect: true, // Don't connect immediately
            retryStrategy: (times: number) => {
              if (times > 3) return null; // Stop retrying after 3 attempts
              return Math.min(times * 100, 3000);
            },
          },
          // Default job options for better performance
          defaultJobOptions: {
            removeOnComplete: {
              age: 3600, // 1 hour
              count: 1000,
            },
            removeOnFail: {
              age: 86400, // 24 hours
              count: 5000,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      {
        name: 'pdf-extract',
        // Worker settings to reduce Redis polling
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
      {
        name: 'pdf-notes',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
      {
        name: 'pdf-notes-optimized',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000, // Faster retry for optimized queue
          },
          removeOnComplete: {
            age: 3600,
            count: 1000,
          },
        },
      },
      {
        name: 'pdf-ultra-optimized',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            age: 3600,
            count: 1000,
          },
        },
      },
      {
        name: 'ai-notes',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
        },
      },
      {
        name: 'ai-quiz',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
        },
      },
      {
        name: 'completion',
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
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
    PdfNotesOptimizedWorker,
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
