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
import { PdfNotesWorker } from './workers/pdf-notes.worker';
import { AiNotesWorker } from './workers/ai-notes.worker';
import { DatabaseModule } from '../database/database.module';
import { AiModule } from '../ai/ai.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { CompletionWorker } from './workers/completion.worker';
import { CompletionQueue } from './queues/completion.queue';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AiModule,
    WebsocketModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // BullMQ requires a standard Redis connection (not Upstash REST API)
        // You'll need to add REDIS_HOST, REDIS_PORT, REDIS_PASSWORD to your .env
        // For Upstash, use their Redis TCP endpoint
        const redisHost = configService.get<string>('REDIS_HOST');
        const redisPort = configService.get<number>('REDIS_PORT');
        const redisPassword = configService.get<string>('REDIS_PASSWORD');

        return {
          connection: {
            host: redisHost,
            port: redisPort,
            password: redisPassword,
            // For Upstash with TLS
            tls: redisPassword ? {} : undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'pdf-extract' },
      { name: 'pdf-notes' },
      { name: 'ai-notes' },
      { name: 'ai-quiz' },
      { name: 'completion' },
    ),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    PdfExtractQueue,
    PdfNotesQueue,
    AiNotesQueue,
    AiQuizQueue,
    CompletionQueue,
    PdfExtractWorker,
    PdfNotesWorker,
    AiNotesWorker,
    CompletionWorker,
  ],
  exports: [
    JobsService,
    PdfExtractQueue,
    PdfNotesQueue,
    AiNotesQueue,
    AiQuizQueue,
    CompletionQueue,
  ],
})
export class JobsModule {}
