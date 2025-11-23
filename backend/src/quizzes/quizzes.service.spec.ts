import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { DatabaseService } from '../database/database.service';

describe('QuizzesService', () => {
  let service: QuizzesService;
  let databaseService: DatabaseService;

  const mockDatabaseService = {
    quiz: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockQuestions = [
    {
      question: 'What is 2+2?',
      options: ['3', '4', '5', '6'],
      correctAnswer: 1,
    },
  ];

  const mockQuiz = {
    id: '1',
    title: 'Test Quiz',
    questions: mockQuestions,
    score: null,
    userId: 'user-1',
    noteId: 'note-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizzesService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<QuizzesService>(QuizzesService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createQuiz', () => {
    it('should create a quiz successfully', async () => {
      mockDatabaseService.quiz.create.mockResolvedValue(mockQuiz);

      const result = await service.createQuiz(
        'user-1',
        'Test Quiz',
        mockQuestions,
        'note-1',
      );

      expect(result).toEqual(mockQuiz);
      expect(mockDatabaseService.quiz.create).toHaveBeenCalledWith({
        data: {
          title: 'Test Quiz',
          questions: mockQuestions,
          userId: 'user-1',
          noteId: 'note-1',
        },
      });
    });

    it('should create a quiz without noteId', async () => {
      const quizWithoutNote = { ...mockQuiz, noteId: null };
      mockDatabaseService.quiz.create.mockResolvedValue(quizWithoutNote);

      const result = await service.createQuiz(
        'user-1',
        'Test Quiz',
        mockQuestions,
      );

      expect(result).toEqual(quizWithoutNote);
      expect(mockDatabaseService.quiz.create).toHaveBeenCalledWith({
        data: {
          title: 'Test Quiz',
          questions: mockQuestions,
          userId: 'user-1',
          noteId: null,
        },
      });
    });
  });

  describe('getUserQuizzes', () => {
    it('should return all quizzes for a user', async () => {
      const mockQuizzes = [
        {
          ...mockQuiz,
          note: { id: 'note-1', title: 'Test Note' },
        },
        {
          ...mockQuiz,
          id: '2',
          note: { id: 'note-2', title: 'Another Note' },
        },
      ];
      mockDatabaseService.quiz.findMany.mockResolvedValue(mockQuizzes);

      const result = await service.getUserQuizzes('user-1');

      expect(result).toEqual(mockQuizzes);
      expect(mockDatabaseService.quiz.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
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
    });

    it('should return empty array if user has no quizzes', async () => {
      mockDatabaseService.quiz.findMany.mockResolvedValue([]);

      const result = await service.getUserQuizzes('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getQuizById', () => {
    it('should return a quiz by id', async () => {
      const quizWithNote = {
        ...mockQuiz,
        note: {
          id: 'note-1',
          title: 'Test Note',
          content: 'Test content',
          source: null,
          userId: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      mockDatabaseService.quiz.findFirst.mockResolvedValue(quizWithNote);

      const result = await service.getQuizById('1', 'user-1');

      expect(result).toEqual(quizWithNote);
      expect(mockDatabaseService.quiz.findFirst).toHaveBeenCalledWith({
        where: {
          id: '1',
          userId: 'user-1',
        },
        include: {
          note: true,
        },
      });
    });

    it('should throw NotFoundException if quiz not found', async () => {
      mockDatabaseService.quiz.findFirst.mockResolvedValue(null);

      await expect(service.getQuizById('1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateQuizScore', () => {
    it('should update quiz score successfully', async () => {
      const updatedQuiz = { ...mockQuiz, score: 85 };
      mockDatabaseService.quiz.findFirst.mockResolvedValue(mockQuiz);
      mockDatabaseService.quiz.update.mockResolvedValue(updatedQuiz);

      const result = await service.updateQuizScore('1', 'user-1', 85);

      expect(result).toEqual(updatedQuiz);
      expect(mockDatabaseService.quiz.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { score: 85 },
      });
    });

    it('should throw NotFoundException if quiz not found', async () => {
      mockDatabaseService.quiz.findFirst.mockResolvedValue(null);

      await expect(service.updateQuizScore('1', 'user-1', 85)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteQuiz', () => {
    it('should delete a quiz successfully', async () => {
      mockDatabaseService.quiz.findFirst.mockResolvedValue(mockQuiz);
      mockDatabaseService.quiz.delete.mockResolvedValue(mockQuiz);

      const result = await service.deleteQuiz('1', 'user-1');

      expect(result).toEqual(mockQuiz);
      expect(mockDatabaseService.quiz.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException if quiz not found', async () => {
      mockDatabaseService.quiz.findFirst.mockResolvedValue(null);

      await expect(service.deleteQuiz('1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
