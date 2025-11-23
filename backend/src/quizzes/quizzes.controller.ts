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
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto, UpdateQuizScoreDto } from './dto/quiz.dto';
import { Quiz } from '@prisma/client';

@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createQuiz(@Body() dto: CreateQuizDto): Promise<Quiz> {
    return this.quizzesService.createQuiz(
      dto.userId,
      dto.title,
      dto.questions,
      dto.noteId,
    );
  }

  @Get('user/:userId')
  async getUserQuizzes(@Param('userId') userId: string): Promise<unknown> {
    return this.quizzesService.getUserQuizzes(userId);
  }

  @Get(':quizId/user/:userId')
  async getQuizById(
    @Param('quizId') quizId: string,
    @Param('userId') userId: string,
  ): Promise<unknown> {
    return this.quizzesService.getQuizById(quizId, userId);
  }

  @Put(':quizId/user/:userId/score')
  async updateQuizScore(
    @Param('quizId') quizId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateQuizScoreDto,
  ): Promise<unknown> {
    return this.quizzesService.updateQuizScore(quizId, userId, dto.score);
  }

  @Delete(':quizId/user/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuiz(
    @Param('quizId') quizId: string,
    @Param('userId') userId: string,
  ) {
    await this.quizzesService.deleteQuiz(quizId, userId);
  }
}
