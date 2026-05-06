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
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { GenerateNotesDto } from './dto/generate-notes.dto';
import { GenerateQuizDto } from './dto/generate-quiz.dto';
import { TutorChatDto, UpdateChatSessionTitleDto } from './dto/tutor-chat.dto';
import { Throttle } from '../common/decorators/throttle.decorator';
import { UsageGuard } from 'src/common/guards/usage.guard';
import { UsageService } from 'src/usage/usage.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { EmailVerifiedGuard } from 'src/auth/guards/email-verified.guard';

@Controller('ai')
@UseGuards(AuthGuard, EmailVerifiedGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly usageService: UsageService,
  ) {}

  // ============ AI GENERATION ENDPOINTS ============

  @Post('generate/notes')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(5, 60)
  @UseGuards(UsageGuard)
  async generateNotes(
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateNotesDto,
  ) {
    const result = await this.aiService.generateNotes(
      dto.pdfText,
      userId,
      dto.title,
      dto.source,
    );

    await this.usageService.incrementAttempts(userId);

    return result;
  }

  @Post('generate/quiz')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(UsageGuard)
  @Throttle(5, 60)
  async generateQuiz(
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateQuizDto,
  ) {
    const result = await this.aiService.generateQuiz(
      dto.studyNotes,
      userId,
      dto.title,
      dto.noteId,
    );

    await this.usageService.incrementAttempts(userId);

    return result;
  }

  // ============ TUTOR CHAT ENDPOINTS ============

  @Post('tutor/chat')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(20, 60)
  async tutorChat(
    @CurrentUser('id') userId: string,
    @Body() dto: TutorChatDto,
  ) {
    return this.aiService.tutorChat(
      dto.userQuestion,
      userId,
      dto.sessionId,
      dto.noteId,
    );
  }

  @Post('tutor/chat/stream')
  @Throttle(20, 60)
  async tutorChatStream(
    @CurrentUser('id') userId: string,
    @Body() dto: TutorChatDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      await this.aiService.tutorChatStream(
        dto.userQuestion,
        userId,
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

  @Get('tutor/sessions')
  async getUserChatSessions(
    @CurrentUser('id') userId: string,
  ): Promise<unknown> {
    return this.aiService.getUserChatSessions(userId);
  }

  @Get('tutor/sessions/:sessionId')
  async getChatSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ): Promise<unknown> {
    return this.aiService.getChatSession(sessionId, userId);
  }

  @Put('tutor/sessions/:sessionId/title')
  async updateChatSessionTitle(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateChatSessionTitleDto,
  ): Promise<unknown> {
    return this.aiService.updateChatSessionTitle(sessionId, userId, dto.title);
  }

  @Delete('tutor/sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteChatSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    await this.aiService.deleteChatSession(sessionId, userId);
  }
}
