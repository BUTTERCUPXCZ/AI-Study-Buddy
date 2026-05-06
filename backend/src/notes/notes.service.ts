import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Note } from '@prisma/client';

// Trim list responses to this many characters of content. The card UI
// only displays the first ~150 chars as an excerpt, so 500 is enough for
// the line-clamp + a small buffer. Fetching a full note is one extra
// `GET /notes/:id` call away when the client genuinely needs it
// (download, edit, view).
const LIST_EXCERPT_CHARS = 500;

function trimNoteForList<T extends Pick<Note, 'content'>>(note: T): T {
  if (note.content.length <= LIST_EXCERPT_CHARS) return note;
  return { ...note, content: note.content.slice(0, LIST_EXCERPT_CHARS) };
}

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
   * Cursor-paginated notes listing. Returns at most `limit` notes ordered
   * by createdAt DESC. `nextCursor` is the id of the last item — pass it
   * back as `cursor` for the next page. Returns `nextCursor: null` when
   * there are no more rows.
   *
   * Cursor pagination beats OFFSET because the DB never has to count and
   * skip — it does an index range scan from the cursor row, which stays
   * O(limit) regardless of how deep the user has scrolled.
   */
  async getUserNotesPaginated(
    userId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<{ items: Note[]; nextCursor: string | null }> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
    const items = await this.databaseService.note.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options.cursor && {
        cursor: { id: options.cursor },
        skip: 1,
      }),
    });
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page.map((n) => trimNoteForList(n)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
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
      } catch {
        this.logger.warn(
          `Invalid cache data for user ${userId}, fetching from DB`,
        );
        await this.redisService.del(cacheKey);
      }
    }

    this.logger.log(`Fetching notes from database for user: ${userId}`);
    const notes = await this.databaseService.note.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const trimmed = notes.map((n) => trimNoteForList(n));

    // Cache the trimmed result. The full content is still available
    // via getNoteById; the cache holds only the small list payload.
    await this.redisService.set(cacheKey, JSON.stringify(trimmed), 3600);

    return trimmed;
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
        this.logger.log(
          `Fetching note ${noteId} from cache for user: ${userId}`,
        );
        return JSON.parse(cachedNote);
      } catch {
        this.logger.warn(
          `Invalid cache data for note ${noteId}, fetching from DB`,
        );
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
