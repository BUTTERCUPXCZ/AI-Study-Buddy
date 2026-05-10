import { api } from '../lib/api';

export interface Note {
  id: string;
  title: string;
  content: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface CreateNoteResponse {
  id: string;
  title: string;
  content: string;
  source?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

class NotesService {
  /**
   * Get all notes for the current user
   */
  async getUserNotes(): Promise<Note[]> {
    try {
      const response = await api.get(`/notes`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Failed to fetch notes');
    }
  }

  /**
   * Get a specific note (must be owned by current user)
   */
  async getNote(noteId: string): Promise<Note> {
    try {
      const response = await api.get(`/notes/${noteId}`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Failed to fetch note');
    }
  }

  /**
   * Update a note
   */
  async updateNote(
    noteId: string,
    data: { title?: string; content?: string }
  ): Promise<Note> {
    try {
      const response = await api.put(`/notes/${noteId}`, data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Failed to update note');
    }
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<void> {
    try {
      await api.delete(`/notes/${noteId}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Failed to delete note');
    }
  }
}

export default new NotesService();
