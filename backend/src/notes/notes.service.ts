import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Note } from '@prisma/client';

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Create a new note
   */
  async createNote(
    userId: string,
    title: string,
    content: string,
    source?: string,
  ): Promise<Note> {
    this.logger.log(`Creating note for user: ${userId}`);

    const note = await this.databaseService.note.create({
      data: {
        title,
        content,
        source: source || null,
        userId,
      },
    });

    // Emit an event instead of invalidating cache
    this.eventEmitter.emit('note.created', { userId });

    return note;
  }

  /**
   * Get all notes for a user
   */
  async getUserNotes(userId: string): Promise<unknown> {
    const cacheKey = `user:${userId}:notes`;

    // Try to get from cache first
    const cachedNotes = await this.redisService.get(cacheKey);
    if (cachedNotes) {
      try {
        this.logger.log(`Fetching notes from cache for user: ${userId}`);
        return JSON.parse(cachedNotes);
      } catch (error) {
        this.logger.warn(`Invalid cache data for user ${userId}, fetching from DB`);
        await this.redisService.del(cacheKey);
      }
    }

    this.logger.log(`Fetching notes from database for user: ${userId}`);
    const notes = await this.databaseService.note.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Cache the result
    await this.redisService.set(cacheKey, JSON.stringify(notes), 3600); // Cache for 1 hour

    return notes;
  }

  /**
   * Get a specific note by ID
   */
  async getNoteById(noteId: string, userId: string): Promise<unknown> {
    const cacheKey = `user:${userId}:note:${noteId}`;

    // Try to get from cache first
    const cachedNote = await this.redisService.get(cacheKey);
    if (cachedNote) {
      try {
        this.logger.log(`Fetching note ${noteId} from cache for user: ${userId}`);
        return JSON.parse(cachedNote);
      } catch (error) {
        this.logger.warn(`Invalid cache data for note ${noteId}, fetching from DB`);
        await this.redisService.del(cacheKey);
      }
    }

    this.logger.log(
      `Fetching note ${noteId} from database for user: ${userId}`,
    );
    const note = await this.databaseService.note.findFirst({
      where: {
        id: noteId,
        userId,
      },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Cache the result
    await this.redisService.set(cacheKey, JSON.stringify(note), 3600); // Cache for 1 hour

    return note;
  }

  /**
   * Update a note
   */
  async updateNote(
    noteId: string,
    userId: string,
    content: string,
    title?: string,
  ): Promise<unknown> {
    await this.getNoteById(noteId, userId);

    const updatedNote = await this.databaseService.note.update({
      where: { id: noteId },
      data: {
        content,
        ...(title && { title }),
      },
    });

    // Emit an event
    this.eventEmitter.emit('note.updated', { userId, noteId });

    return updatedNote;
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string, userId: string): Promise<unknown> {
    await this.getNoteById(noteId, userId);

    const deletedNote = await this.databaseService.note.delete({
      where: { id: noteId },
    });

    // Emit an event
    this.eventEmitter.emit('note.deleted', { userId, noteId });

    return deletedNote;
  }
}
