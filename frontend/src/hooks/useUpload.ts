import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import UploadService from '@/services/UploadService';

interface UploadProgress {
  isUploading: boolean;
  progress: number;
  stage: string;
  error: string | null;
}

export const useUploadPdf = () => {
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    isUploading: false,
    progress: 0,
    stage: '',
    error: null,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ 
      file, 
      userId, 
      fileName 
    }: { 
      file: File; 
      userId: string; 
      fileName: string 
    }) => {
      // Reset progress
      setUploadProgress({
        isUploading: true,
        progress: 0,
        stage: 'uploading',
        error: null,
      });

      // Upload the PDF
      const uploadResult = await UploadService.uploadPdf(file, userId, fileName);

      // Poll for job completion
      const jobResult = await UploadService.pollJobStatus(
        uploadResult.jobId,
        (progress, stage) => {
          setUploadProgress(prev => ({
            ...prev,
            progress,
            stage: stage || '',
          }));
        }
      );

      return { uploadResult, jobResult };
    },
    onSuccess: (_, variables) => {
      // Invalidate notes query to refetch the updated list
      queryClient.invalidateQueries({ queryKey: ['notes', variables.userId] });
      
      // Mark upload as complete and stop showing the modal
      setUploadProgress({
        isUploading: false,
        progress: 100,
        stage: 'completed',
        error: null,
      });
      
      // Reset after a brief delay
      setTimeout(() => {
        setUploadProgress({
          isUploading: false,
          progress: 0,
          stage: '',
          error: null,
        });
      }, 500);
    },
    onError: (error: Error) => {
      setUploadProgress(prev => ({
        ...prev,
        isUploading: false,
        error: error.message,
      }));
    },
  });

  const reset = useCallback(() => {
    setUploadProgress({
      isUploading: false,
      progress: 0,
      stage: '',
      error: null,
    });
  }, []);

  return {
    upload: uploadMutation.mutate,
    uploadAsync: uploadMutation.mutateAsync,
    isUploading: uploadProgress.isUploading,
    progress: uploadProgress.progress,
    stage: uploadProgress.stage,
    error: uploadProgress.error,
    reset,
  };
};
