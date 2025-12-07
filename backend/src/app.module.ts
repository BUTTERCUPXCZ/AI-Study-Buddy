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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configurations,
    }),
    RedisModule,
    AuthModule,
    DatabaseModule,
    JobsModule,
    PdfModule,
    AiModule,
    NotesModule,
    QuizzesModule,
    WebsocketModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
