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

class UploadService {
  /**
   * Upload a PDF file
   */
  async uploadPdf(file: File, userId: string, fileName: string): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);
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
   * Get job status
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

          // Call progress callback if provided
          if (onProgress) {
            onProgress(status.progress || 0, status.opts?.stage);
          }

          // Check if job is completed
          if (status.status === 'completed') {
            clearInterval(poll);
            resolve(status);
            return;
          }

          // Check if job failed
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
   * Get all files for a user
   */
  async getUserFiles(userId: string): Promise<FileData[]> {
    try {
      const response = await api.get(`/upload/user/${userId}`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Failed to fetch files');
    }
  }

  /**
   * Get a single file by ID
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
  async deleteFile(fileId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/upload/${fileId}?userId=${userId}`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Failed to delete file');
    }
  }
}

export default new UploadService();
