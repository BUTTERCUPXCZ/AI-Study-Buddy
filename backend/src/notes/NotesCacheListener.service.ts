import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class NotesCacheListener {
  private readonly logger = new Logger(NotesCacheListener.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Listen for note creation, update, or deletion
   */
  @OnEvent('note.created')
  @OnEvent('note.updated')
  @OnEvent('note.deleted')
  async handleNoteChange(payload: { userId: string, noteId?: string }) {
    await this.invalidateUserNotesCache(payload.userId);
    
    if (payload.noteId) {
      await this.invalidateNoteCache(payload.userId, payload.noteId);
    }
  }

  /**
   * Invalidate user notes list cache
   */
  private async invalidateUserNotesCache(userId: string) {
    const cacheKey = `user:${userId}:notes`;
    await this.redisService.del(cacheKey);
    this.logger.log(`Invalidated notes cache for user: ${userId}`);
  }

  /**
   * Invalidate individual note cache
   */
  private async invalidateNoteCache(userId: string, noteId: string) {
    const cacheKey = `user:${userId}:note:${noteId}`;
    await this.redisService.del(cacheKey);
    this.logger.log(`Invalidated note ${noteId} cache for user: ${userId}`);
  }
}