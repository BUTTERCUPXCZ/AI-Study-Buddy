import { api } from '../lib/api';

export interface UploadResponse {
  id: string;
  url: string;
  name: string;
  userId: string;
  jobId: string;
  optimizedJobId?: string;
  message: string;
}

export interface JobStatus {
  id: string;
  jobId: string;
  status: 'waiting' | 'processing' | 'uploading_to_gemini' | 'generating_notes' | 'saving_notes' | 'completed' | 'failed';
  progress: number;
  opts?: {
    stage?: string;
  };
  data?: {
    noteId?: string;
    fileId?: string;
    userId?: string;
    [key: string]: unknown;
  };
  result?: {
    noteId?: string;
    fileId?: string;
    userId?: string;
    [key: string]: unknown;
  };
}

export interface FileData {
  id: string;
  url: string;
  name: string;
  userId: string;
  user?: {
    id: string;
    Fullname: string;
    email: string;
  };
}

export interface StreamCallbacks {
  onMeta?: (meta: { fileId: string; fileName: string }) => void;
  onStatus?: (status: { stage: string; message: string }) => void;
  onChunk: (accumulated: string) => void;
  onDone: (result: { noteId: string; title: string; fileId: string }) => void;
  onError?: (message: string) => void;
}

class UploadService {
  /**
   * Upload a PDF file. userId is derived server-side from the auth cookie.
   */
  async uploadPdf(file: File, fileName: string): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', fileName);

      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Upload failed');
    }
  }

  /**
   * ChatGPT-style upload: POSTs the PDF and reads back a Server-Sent
   * Event stream. Each `chunk` event carries the latest accumulated
   * text — the dialog renders it as the user watches. `done` fires
   * once with the saved noteId; `error` aborts.
   *
   * Uses native fetch (not axios) because axios's response handling
   * does not expose the raw ReadableStream in the browser.
   */
  async uploadAndStreamNotes(
    file: File,
    fileName: string,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', fileName);

    const baseURL =
      (import.meta.env.VITE_API_URL as string | undefined) ||
      'http://localhost:3000';

    // Echo the CSRF cookie as a header — mirrors api.ts interceptor.
    const csrfMatch = document.cookie.match(/csrf_token=([^;]+)/);
    const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';

    const response = await fetch(`${baseURL}/upload/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
      body: formData,
    });

    if (!response.ok) {
      // Validation error (415, 413, etc.) — body is plain JSON, not SSE.
      const text = await response.text();
      let message = 'Upload failed';
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed?.message) message = parsed.message;
      } catch {
        // body wasn't JSON — keep default message
      }
      throw new Error(message);
    }

    if (!response.body) {
      throw new Error('Streaming not supported in this browser');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by blank lines. Process each
        // complete frame, leave any partial in the buffer.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          let event: { type?: string } & Record<string, unknown>;
          try {
            event = JSON.parse(json) as typeof event;
          } catch {
            continue;
          }

          switch (event.type) {
            case 'meta':
              callbacks.onMeta?.({
                fileId: String(event.fileId ?? ''),
                fileName: String(event.fileName ?? ''),
              });
              break;
            case 'status':
              callbacks.onStatus?.({
                stage: String(event.stage ?? ''),
                message: String(event.message ?? ''),
              });
              break;
            case 'chunk':
              callbacks.onChunk(String(event.accumulated ?? ''));
              break;
            case 'done':
              callbacks.onDone({
                noteId: String(event.noteId ?? ''),
                title: String(event.title ?? ''),
                fileId: String(event.fileId ?? ''),
              });
              break;
            case 'error':
              callbacks.onError?.(String(event.message ?? 'Generation failed'));
              break;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get job status (must be owned by current user)
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      const response = await api.get(`/jobs/${jobId}`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Failed to get job status');
    }
  }

  /**
   * Poll job status until completion
   */
  async pollJobStatus(
    jobId: string,
    onProgress?: (progress: number, stage?: string) => void,
    maxAttempts: number = 60,
    interval: number = 2000
  ): Promise<JobStatus> {
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = setInterval(async () => {
        try {
          attempts++;

          if (attempts > maxAttempts) {
            clearInterval(poll);
            reject(new Error('Job polling timeout'));
            return;
          }

          const status = await this.getJobStatus(jobId);

          if (onProgress) {
            onProgress(status.progress || 0, status.opts?.stage);
          }

          if (status.status === 'completed') {
            clearInterval(poll);
            resolve(status);
            return;
          }

          if (status.status === 'failed') {
            clearInterval(poll);
            reject(new Error('Job failed'));
            return;
          }
        } catch (error) {
          clearInterval(poll);
          reject(error);
        }
      }, interval);
    });
  }

  /**
   * Get all files for the current user
   */
  async getUserFiles(): Promise<FileData[]> {
    try {
      const response = await api.get(`/upload`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Failed to fetch files');
    }
  }

  /**
   * Get a single file by ID (must be owned by current user)
   */
  async getFileById(fileId: string): Promise<FileData> {
    try {
      const response = await api.get(`/upload/${fileId}`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Failed to fetch file');
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/upload/${fileId}`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Failed to delete file');
    }
  }
}

export default new UploadService();
