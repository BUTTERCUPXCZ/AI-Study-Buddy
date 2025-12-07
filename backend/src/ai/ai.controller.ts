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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { GenerateNotesDto } from './dto/generate-notes.dto';
import { GenerateQuizDto } from './dto/generate-quiz.dto';
import { TutorChatDto, UpdateChatSessionTitleDto } from './dto/tutor-chat.dto';
import { Throttle } from '../common/decorators/throttle.decorator';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // ============ AI GENERATION ENDPOINTS ============

  @Post('generate/notes')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(5, 60) // 5 requests per minute for note generation
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
  @Throttle(5, 60) // 5 requests per minute for quiz generation
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
  @Throttle(20, 60) // 20 requests per minute for chat
  async tutorChat(@Body() dto: TutorChatDto) {
    return this.aiService.tutorChat(
      dto.userQuestion,
      dto.userId,
      dto.sessionId,
      dto.noteId,
    );
  }

  @Post('tutor/chat/stream')
  @Throttle(20, 60) // 20 requests per minute for streaming chat
  async tutorChatStream(@Body() dto: TutorChatDto, @Res() res: Response) {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    try {
      await this.aiService.tutorChatStream(
        dto.userQuestion,
        dto.userId,
        res,
        dto.sessionId,
        dto.noteId,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  }

  @Get('tutor/sessions/user/:userId')
  async getUserChatSessions(@Param('userId') userId: string): Promise<unknown> {
    return this.aiService.getUserChatSessions(userId);
  }

  @Get('tutor/sessions/:sessionId/user/:userId')
  async getChatSession(
    @Param('sessionId') sessionId: string,
    @Param('userId') userId: string,
  ): Promise<unknown> {
    return this.aiService.getChatSession(sessionId, userId);
  }

  @Put('tutor/sessions/:sessionId/user/:userId/title')
  async updateChatSessionTitle(
    @Param('sessionId') sessionId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateChatSessionTitleDto,
  ): Promise<unknown> {
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
