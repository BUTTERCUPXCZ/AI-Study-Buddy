import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto, UpdateQuizScoreDto } from './dto/quiz.dto';
import { Quiz } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('quizzes')
@UseGuards(AuthGuard, EmailVerifiedGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createQuiz(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateQuizDto,
  ): Promise<Quiz> {
    return this.quizzesService.createQuiz(
      userId,
      dto.title,
      dto.questions,
      dto.noteId,
    );
  }

  @Get()
  async getUserQuizzes(
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    if (!cursor && !limit) {
      return this.quizzesService.getUserQuizzes(userId);
    }
    const parsedLimit = limit ? Number(limit) : 20;
    return this.quizzesService.getUserQuizzesPaginated(userId, {
      cursor,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 20,
    });
  }

  @Get(':quizId')
  async getQuizById(
    @CurrentUser('id') userId: string,
    @Param('quizId') quizId: string,
  ): Promise<unknown> {
    return this.quizzesService.getQuizById(quizId, userId);
  }

  @Put(':quizId/score')
  async updateQuizScore(
    @CurrentUser('id') userId: string,
    @Param('quizId') quizId: string,
    @Body() dto: UpdateQuizScoreDto,
  ): Promise<unknown> {
    return this.quizzesService.updateQuizScore(quizId, userId, dto.score);
  }

  @Delete(':quizId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuiz(
    @CurrentUser('id') userId: string,
    @Param('quizId') quizId: string,
  ) {
    await this.quizzesService.deleteQuiz(quizId, userId);
  }
}
