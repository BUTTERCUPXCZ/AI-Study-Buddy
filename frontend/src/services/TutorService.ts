import { api } from '../lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  noteId?: string;
  note?: {
    id: string;
    title: string;
  };
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface StreamChunk {
  type: 'session' | 'chunk' | 'done' | 'error';
  sessionId?: string;
  content?: string;
  messageId?: string;
  error?: string;
}

class TutorService {
  /**
   * Send a chat message with streaming response
   */
  async sendMessageStream(
    userQuestion: string,
    userId: string,
    onChunk: (chunk: StreamChunk) => void,
    sessionId?: string,
    noteId?: string,
  ): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/ai/tutor/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userQuestion,
          userId,
          sessionId,
          noteId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const chunk: StreamChunk = JSON.parse(data);
              onChunk(chunk);
            } catch (e) {
              console.error('Failed to parse chunk:', e);
            }
          }
        }
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to send message');
    }
  }

  /**
   * Get all chat sessions for a user
   */
  async getUserChatSessions(userId: string): Promise<ChatSession[]> {
    try {
      const response = await api.get(`/ai/tutor/sessions/user/${userId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch chat sessions');
    }
  }

  /**
   * Get a specific chat session
   */
  async getChatSession(sessionId: string, userId: string): Promise<ChatSession> {
    try {
      const response = await api.get(`/ai/tutor/sessions/${sessionId}/user/${userId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch chat session');
    }
  }

  /**
   * Update chat session title
   */
  async updateChatSessionTitle(
    sessionId: string,
    userId: string,
    title: string,
  ): Promise<ChatSession> {
    try {
      const response = await api.put(
        `/ai/tutor/sessions/${sessionId}/user/${userId}/title`,
        { title },
      );
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update session title');
    }
  }

  /**
   * Delete a chat session
   */
  async deleteChatSession(sessionId: string, userId: string): Promise<void> {
    try {
      await api.delete(`/ai/tutor/sessions/${sessionId}/user/${userId}`);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to delete chat session');
    }
  }
}

export default new TutorService();
