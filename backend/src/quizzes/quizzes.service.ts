import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class QuizzesService {
  private readonly logger = new Logger(QuizzesService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create a new quiz
   */
  async createQuiz(
    userId: string,
    title: string,
    questions: Prisma.InputJsonValue,
    noteId?: string,
  ) {
    this.logger.log(`Creating quiz for user: ${userId}`);

    return this.databaseService.quiz.create({
      data: {
        title,
        questions: questions, // Prisma Json type
        userId,
        noteId: noteId || null,
      },
    });
  }

  /**
   * Get all quizzes for a user
   */
  async getUserQuizzes(userId: string) {
    return this.databaseService.quiz.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        note: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Get a specific quiz by ID
   */
  async getQuizById(quizId: string, userId: string) {
    const quiz = await this.databaseService.quiz.findFirst({
      where: {
        id: quizId,
        userId,
      },
      include: {
        note: true,
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return quiz;
  }

  /**
   * Update quiz score
   */
  async updateQuizScore(quizId: string, userId: string, score: number) {
    const quiz = await this.getQuizById(quizId, userId);

    return this.databaseService.quiz.update({
      where: { id: quiz.id },
      data: { score },
    });
  }

  /**
   * Delete a quiz
   */
  async deleteQuiz(quizId: string, userId: string) {
    const quiz = await this.getQuizById(quizId, userId);

    return this.databaseService.quiz.delete({
      where: { id: quiz.id },
    });
  }
}
