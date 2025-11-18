import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateNotesDto } from './dto/generate-notes.dto';
import { GenerateQuizDto } from './dto/generate-quiz.dto';
import { TutorChatDto, UpdateChatSessionTitleDto } from './dto/tutor-chat.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // ============ AI GENERATION ENDPOINTS ============

  @Post('generate/notes')
  @HttpCode(HttpStatus.CREATED)
  async generateNotes(@Body() dto: GenerateNotesDto) {
    return this.aiService.generateNotes(
      dto.pdfText,
      dto.userId,
      dto.title,
      dto.source,
    );
  }

  @Post('generate/quiz')
  @HttpCode(HttpStatus.CREATED)
  async generateQuiz(@Body() dto: GenerateQuizDto) {
    return this.aiService.generateQuiz(
      dto.studyNotes,
      dto.userId,
      dto.title,
      dto.noteId,
    );
  }

  // ============ TUTOR CHAT ENDPOINTS ============

  @Post('tutor/chat')
  @HttpCode(HttpStatus.CREATED)
  async tutorChat(@Body() dto: TutorChatDto) {
    return this.aiService.tutorChat(
      dto.userQuestion,
      dto.userId,
      dto.sessionId,
      dto.noteId,
    );
  }

  @Get('tutor/sessions/user/:userId')
  async getUserChatSessions(@Param('userId') userId: string) {
    return this.aiService.getUserChatSessions(userId);
  }

  @Get('tutor/sessions/:sessionId/user/:userId')
  async getChatSession(
    @Param('sessionId') sessionId: string,
    @Param('userId') userId: string,
  ) {
    return this.aiService.getChatSession(sessionId, userId);
  }

  @Put('tutor/sessions/:sessionId/user/:userId/title')
  async updateChatSessionTitle(
    @Param('sessionId') sessionId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateChatSessionTitleDto,
  ) {
    return this.aiService.updateChatSessionTitle(sessionId, userId, dto.title);
  }

  @Delete('tutor/sessions/:sessionId/user/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteChatSession(
    @Param('sessionId') sessionId: string,
    @Param('userId') userId: string,
  ) {
    await this.aiService.deleteChatSession(sessionId, userId);
  }
}
