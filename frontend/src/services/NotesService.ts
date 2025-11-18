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
   * Get all notes for a user
   */
  async getUserNotes(userId: string): Promise<Note[]> {
    try {
      const response = await api.get(`/notes/user/${userId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch notes');
    }
  }

  /**
   * Get a specific note
   */
  async getNote(noteId: string, userId: string): Promise<Note> {
    try {
      const response = await api.get(`/notes/${noteId}/user/${userId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch note');
    }
  }

  /**
   * Update a note
   */
  async updateNote(
    noteId: string,
    userId: string,
    data: { title?: string; content?: string }
  ): Promise<Note> {
    try {
      const response = await api.put(`/notes/${noteId}/user/${userId}`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update note');
    }
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string, userId: string): Promise<void> {
    try {
      await api.delete(`/notes/${noteId}/user/${userId}`);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to delete note');
    }
  }
}

export default new NotesService();
