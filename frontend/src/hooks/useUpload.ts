import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
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
      fileName,
    }: {
      file: File;
      userId: string;
      fileName: string;
    }) => {
      setUploadProgress({
        isUploading: true,
        progress: 0,
        stage: 'uploading',
        error: null,
      });

      const uploadResult = await UploadService.uploadPdf(file, fileName);

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
      queryClient.invalidateQueries({ queryKey: ['notes', variables.userId] });

      setUploadProgress({
        isUploading: false,
        progress: 100,
        stage: 'completed',
        error: null,
      });

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

export const useUserFiles = (userId: string) => {
  return useQuery({
    queryKey: ['files', userId],
    queryFn: () => UploadService.getUserFiles(),
    enabled: !!userId,
  });
};

export const useFile = (fileId: string) => {
  return useQuery({
    queryKey: ['file', fileId],
    queryFn: () => UploadService.getFileById(fileId),
    enabled: !!fileId,
  });
};

export const useDeleteFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fileId }: { fileId: string; userId: string }) =>
      UploadService.deleteFile(fileId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['files', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['notes', variables.userId] });
    },
  });
};
