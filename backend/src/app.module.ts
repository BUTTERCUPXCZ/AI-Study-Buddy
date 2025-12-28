import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { PdfModule } from './uploads/pdf.module';
import { RedisModule } from './redis/redis.module';
import { AiModule } from './ai/ai.module';
import { NotesModule } from './notes/notes.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { WebsocketModule } from './websocket/websocket.module';
import { JobsModule } from './jobs/jobs.module';
import configurations from './config';
import { HealthController } from './health.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RedisThrottlerGuard } from './common/guards/redis-throttler.guard';
import { RedisThrottlerStorage } from './common/storage/redis-throttler.storage';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { StripeModule } from './stripe/stripe.module';
import { UsageService } from './usage/usage.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configurations,
    }),
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000, // 1 second
            limit: 10, // 10 requests per second
          },
          {
            name: 'medium',
            ttl: 10000, // 10 seconds
            limit: 50, // 50 requests per 10 seconds
          },
          {
            name: 'long',
            ttl: 60000, // 1 minute
            limit: 100, // 100 requests per minute
          },
        ],
        storage,
      }),
      inject: [RedisThrottlerStorage],
    }),
    AuthModule,
    DatabaseModule,
    JobsModule,
    PdfModule,
    AiModule,
    NotesModule,
    QuizzesModule,
    WebsocketModule,
    SubscriptionsModule,
    StripeModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RedisThrottlerGuard,
    },
    UsageService,
  ],
})
export class AppModule {}
