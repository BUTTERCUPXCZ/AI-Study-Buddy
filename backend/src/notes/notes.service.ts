import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);
  private readonly CACHE_TTL = 300; // 5 minutes cache

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2, // Inject this
  ) {}

  /**
   * Create a new note
   */
  async createNote(
    userId: string,
    title: string,
    content: string,
    source?: string,
  ) {
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
    this.eventEmitter.emit(
      'note.created',
      { userId }
    );

    return note;
  }

  /**
   * Get all notes for a user
   */
  async getUserNotes(userId: string) {
    const cacheKey = `user:${userId}:notes`;

    // Try to get from cache first
    const cachedNotes = await this.redisService.get(cacheKey);
    if (cachedNotes) {
      this.logger.log(`Retrieved notes from cache for user: ${userId}`);
      return cachedNotes;
    }

    // If not in cache, get from database
    this.logger.log(`Cache miss - fetching notes from database for user: ${userId}`);
    const notes = await this.databaseService.note.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Store in cache for future requests
    await this.redisService.set(cacheKey, notes, this.CACHE_TTL);

    return notes;
  }

  /**
   * Get a specific note by ID
   */
  async getNoteById(noteId: string, userId: string) {
    const cacheKey = `user:${userId}:note:${noteId}`;

    // Try to get from cache first
    const cachedNote = await this.redisService.get(cacheKey);
    if (cachedNote) {
      this.logger.log(`Retrieved note ${noteId} from cache for user: ${userId}`);
      return cachedNote;
    }

    // If not in cache, get from database
    this.logger.log(`Cache miss - fetching note ${noteId} from database for user: ${userId}`);
    const note = await this.databaseService.note.findFirst({
      where: {
        id: noteId,
        userId,
      },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Store in cache for future requests
    await this.redisService.set(cacheKey, note, this.CACHE_TTL);

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
  ) {
    const note = await this.getNoteById(noteId, userId);

    const updatedNote = await this.databaseService.note.update({
      where: { id: noteId },
      data: {
        content,
        ...(title && { title }),
      },
    });

    // Emit an event
    this.eventEmitter.emit(
      'note.updated',
      { userId, noteId }
    );

    return updatedNote;
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string, userId: string) {
    const note = await this.getNoteById(noteId, userId);

    const deletedNote = await this.databaseService.note.delete({
      where: { id: noteId },
    });

   // Emit an event
    this.eventEmitter.emit(
      'note.deleted',
      { userId, noteId }
    );

    return deletedNote;
  }


}
