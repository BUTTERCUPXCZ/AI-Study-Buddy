import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Prisma, Quiz, Note } from '@prisma/client';

@Injectable()
export class QuizzesService {
  private readonly logger = new Logger(QuizzesService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create a new quiz
   */
  createQuiz(
    userId: string,
    title: string,
    questions: Prisma.InputJsonValue,
    noteId?: string,
  ): Promise<Quiz> {
    this.logger.log(`Creating quiz for user: ${userId}`);

    return this.databaseService.quiz.create({
      data: {
        title,
        questions: questions, // Prisma Json type
        userId,
        noteId: noteId || null,
      },
    }) as Promise<Quiz>;
  }

  /**
   * Get all quizzes for a user
   */
  getUserQuizzes(userId: string): Promise<unknown> {
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
    }) as Promise<unknown>;
  }

  /**
   * Cursor-paginated quiz listing. See NotesService.getUserNotesPaginated
   * for rationale — index range scan instead of OFFSET.
   */
  async getUserQuizzesPaginated(
    userId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
    const items = await this.databaseService.quiz.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        note: { select: { id: true, title: true } },
      },
      ...(options.cursor && {
        cursor: { id: options.cursor },
        skip: 1,
      }),
    });
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /**
   * Get a specific quiz by ID
   */
  async getQuizById(quizId: string, userId: string): Promise<unknown> {
    const quiz = (await this.databaseService.quiz.findFirst({
      where: {
        id: quizId,
        userId,
      },
      include: {
        note: true,
      },
    })) as (Quiz & { note: Note | null }) | null;

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return quiz as unknown;
  }

  /**
   * Update quiz score
   */
  async updateQuizScore(
    quizId: string,
    userId: string,
    score: number,
  ): Promise<unknown> {
    const quiz = (await this.getQuizById(quizId, userId)) as Quiz & {
      note: Note | null;
    };

    return this.databaseService.quiz.update({
      where: { id: quiz.id },
      data: { score },
    }) as Promise<unknown>;
  }

  /**
   * Delete a quiz
   */
  async deleteQuiz(quizId: string, userId: string): Promise<unknown> {
    const quiz = (await this.getQuizById(quizId, userId)) as Quiz & {
      note: Note | null;
    };

    return this.databaseService.quiz.delete({
      where: { id: quiz.id },
    }) as Promise<unknown>;
  }
}
