import { Module } from '@nestjs/common';
import { NotesService } from './notes.service';
import { NotesController } from './notes.controller';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotesCacheListener } from './NotesCacheListener.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    EventEmitterModule.forRoot(),
    AuthModule,
  ],
  controllers: [NotesController],
  providers: [NotesService, NotesCacheListener],
  exports: [NotesService],
})
export class NotesModule {}
