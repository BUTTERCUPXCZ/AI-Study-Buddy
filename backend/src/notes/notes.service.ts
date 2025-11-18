import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(private readonly databaseService: DatabaseService) {}

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
    
    return this.databaseService.note.create({
      data: {
        title,
        content,
        source: source || null,
        userId,
      },
    });
  }

  /**
   * Get all notes for a user
   */
  async getUserNotes(userId: string) {
    return this.databaseService.note.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a specific note by ID
   */
  async getNoteById(noteId: string, userId: string) {
    const note = await this.databaseService.note.findFirst({
      where: {
        id: noteId,
        userId,
      },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

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

    return this.databaseService.note.update({
      where: { id: note.id },
      data: {
        content,
        ...(title && { title }),
      },
    });
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string, userId: string) {
    const note = await this.getNoteById(noteId, userId);

    return this.databaseService.note.delete({
      where: { id: note.id },
    });
  }
}
