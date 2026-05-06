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
import { APP_GUARD } from '@nestjs/core';
import { RedisThrottlerGuard } from './common/guards/redis-throttler.guard';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { StripeModule } from './stripe/stripe.module';
import { UsageService } from './usage/usage.service';
import { CommonModule } from './common/common.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configurations,
    }),
    RedisModule,
    CommonModule,
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
    AdminModule,
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
