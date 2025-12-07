import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';
import { DatabaseService } from '../database/database.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../redis/redis.service';

describe('NotesService', () => {
  let service: NotesService;

  const mockDatabaseService = {
    note: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockNote = {
    id: '1',
    title: 'Test Note',
    content: 'Test content',
    source: 'test-source',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNote', () => {
    it('should create a note successfully', async () => {
      mockDatabaseService.note.create.mockResolvedValue(mockNote);

      const result = await service.createNote(
        'user-1',
        'Test Note',
        'Test content',
        'test-source',
      );

      expect(result).toEqual(mockNote);
      expect(mockDatabaseService.note.create).toHaveBeenCalledWith({
        data: {
          title: 'Test Note',
          content: 'Test content',
          source: 'test-source',
          userId: 'user-1',
        },
      });
    });

    it('should create a note without source', async () => {
      const noteWithoutSource = { ...mockNote, source: null };
      mockDatabaseService.note.create.mockResolvedValue(noteWithoutSource);

      const result = await service.createNote(
        'user-1',
        'Test Note',
        'Test content',
      );

      expect(result).toEqual(noteWithoutSource);
      expect(mockDatabaseService.note.create).toHaveBeenCalledWith({
        data: {
          title: 'Test Note',
          content: 'Test content',
          source: null,
          userId: 'user-1',
        },
      });
    });
  });

  describe('getUserNotes', () => {
    it('should return all notes for a user', async () => {
      const mockNotes = [mockNote, { ...mockNote, id: '2' }];
      mockDatabaseService.note.findMany.mockResolvedValue(mockNotes);

      const result = await service.getUserNotes('user-1');

      expect(result).toEqual(mockNotes);
      expect(mockDatabaseService.note.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array if user has no notes', async () => {
      mockDatabaseService.note.findMany.mockResolvedValue([]);

      const result = await service.getUserNotes('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getNoteById', () => {
    it('should return a note by id', async () => {
      mockDatabaseService.note.findFirst.mockResolvedValue(mockNote);

      const result = await service.getNoteById('1', 'user-1');

      expect(result).toEqual(mockNote);
      expect(mockDatabaseService.note.findFirst).toHaveBeenCalledWith({
        where: {
          id: '1',
          userId: 'user-1',
        },
      });
    });

    it('should throw NotFoundException if note not found', async () => {
      mockDatabaseService.note.findFirst.mockResolvedValue(null);

      await expect(service.getNoteById('1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateNote', () => {
    it('should update a note successfully', async () => {
      const updatedNote = { ...mockNote, content: 'Updated content' };
      mockDatabaseService.note.findFirst.mockResolvedValue(mockNote);
      mockDatabaseService.note.update.mockResolvedValue(updatedNote);

      const result = await service.updateNote(
        '1',
        'user-1',
        'Updated content',
        'Updated Title',
      );

      expect(result).toEqual(updatedNote);
      expect(mockDatabaseService.note.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          content: 'Updated content',
          title: 'Updated Title',
        },
      });
    });

    it('should update only content if title not provided', async () => {
      const updatedNote = { ...mockNote, content: 'Updated content' };
      mockDatabaseService.note.findFirst.mockResolvedValue(mockNote);
      mockDatabaseService.note.update.mockResolvedValue(updatedNote);

      const result = await service.updateNote('1', 'user-1', 'Updated content');

      expect(result).toEqual(updatedNote);
      expect(mockDatabaseService.note.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          content: 'Updated content',
        },
      });
    });

    it('should throw NotFoundException if note not found', async () => {
      mockDatabaseService.note.findFirst.mockResolvedValue(null);

      await expect(
        service.updateNote('1', 'user-1', 'Updated content'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteNote', () => {
    it('should delete a note successfully', async () => {
      mockDatabaseService.note.findFirst.mockResolvedValue(mockNote);
      mockDatabaseService.note.delete.mockResolvedValue(mockNote);

      const result = await service.deleteNote('1', 'user-1');

      expect(result).toEqual(mockNote);
      expect(mockDatabaseService.note.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException if note not found', async () => {
      mockDatabaseService.note.findFirst.mockResolvedValue(null);

      await expect(service.deleteNote('1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
