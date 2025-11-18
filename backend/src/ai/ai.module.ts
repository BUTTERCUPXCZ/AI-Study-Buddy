import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { DatabaseModule } from '../database/database.module';
import { NotesModule } from '../notes/notes.module';
import { QuizzesModule } from '../quizzes/quizzes.module';

@Module({
  imports: [DatabaseModule, NotesModule, QuizzesModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
