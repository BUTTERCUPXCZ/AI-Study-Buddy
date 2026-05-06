import { api } from '../lib/api';

export interface QuizQuestion {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  score?: number;
  createdAt: string;
  updatedAt: string;
  userId: string;
  noteId?: string;
  note?: {
    id: string;
    title: string;
  };
}

export interface GenerateQuizFromNoteResponse {
  questions: QuizQuestion[];
  success: boolean;
  quizId?: string;
  error?: string;
}

class QuizService {
  /**
   * Generate quiz from a note's content
   */
  async generateQuizFromNote(
    noteId: string,
    noteTitle: string,
    noteContent: string
  ): Promise<GenerateQuizFromNoteResponse> {
    try {
      const response = await api.post('/ai/generate/quiz', {
        studyNotes: noteContent,
        title: `Quiz: ${noteTitle}`,
        noteId,
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(
        err.response?.data?.message || 'Failed to generate quiz'
      );
    }
  }

  /**
   * Get all quizzes for the current user
   */
  async getUserQuizzes(): Promise<Quiz[]> {
    try {
      const response = await api.get(`/quizzes`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(
        err.response?.data?.message || 'Failed to fetch quizzes'
      );
    }
  }

  /**
   * Get a specific quiz by ID
   */
  async getQuiz(quizId: string): Promise<Quiz> {
    try {
      const response = await api.get(`/quizzes/${quizId}`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(
        err.response?.data?.message || 'Failed to fetch quiz'
      );
    }
  }

  /**
   * Update quiz score
   */
  async updateQuizScore(
    quizId: string,
    score: number
  ): Promise<Quiz> {
    try {
      const response = await api.put(`/quizzes/${quizId}/score`, {
        score,
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(
        err.response?.data?.message || 'Failed to update quiz score'
      );
    }
  }

  /**
   * Delete a quiz
   */
  async deleteQuiz(quizId: string): Promise<void> {
    try {
      await api.delete(`/quizzes/${quizId}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(
        err.response?.data?.message || 'Failed to delete quiz'
      );
    }
  }
}

export default new QuizService();
