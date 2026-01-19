import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QuizService from '@/services/QuizService';

/**
 * Hook to fetch all quizzes for a user
 */
export const useQuizzes = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['quizzes', userId],
    queryFn: () => QuizService.getUserQuizzes(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // Keep data fresh for 5 minutes
    gcTime: 1000 * 60 * 10, // Cache for 10 minutes
    refetchOnMount: false, // Don't refetch if still fresh
    refetchOnWindowFocus: false, // Don't refetch on focus
  });
};

/**
 * Hook to fetch a single quiz by ID
 */
export const useQuiz = (quizId: string, userId: string | undefined) => {
  return useQuery({
    queryKey: ['quiz', quizId, userId],
    queryFn: () => QuizService.getQuiz(quizId, userId!),
    enabled: !!quizId && !!userId,
    staleTime: 1000 * 60 * 5, // Keep data fresh for 5 minutes
    gcTime: 1000 * 60 * 10, // Cache for 10 minutes
    refetchOnMount: false, // Don't refetch if still fresh
    refetchOnWindowFocus: false, // Don't refetch on focus
  });
};

/**
 * Hook to generate a quiz from a note
 */
export const useGenerateQuizFromNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      userId,
      noteTitle,
      noteContent,
    }: {
      noteId: string;
      userId: string;
      noteTitle: string;
      noteContent: string;
    }) => QuizService.generateQuizFromNote(noteId, userId, noteTitle, noteContent),
    onSuccess: (_, variables) => {
      // Invalidate quizzes list to show the new quiz
      queryClient.invalidateQueries({ queryKey: ['quizzes', variables.userId] });
    },
  });
};

/**
 * Hook to update quiz score
 */
export const useUpdateQuizScore = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      userId,
      score,
    }: {
      quizId: string;
      userId: string;
      score: number;
    }) => QuizService.updateQuizScore(quizId, userId, score),
    onSuccess: (_, variables) => {
      // Invalidate quiz and quizzes list
      queryClient.invalidateQueries({ 
        queryKey: ['quiz', variables.quizId, variables.userId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['quizzes', variables.userId] 
      });
    },
  });
};

/**
 * Hook to delete a quiz
 */
export const useDeleteQuiz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, userId }: { quizId: string; userId: string }) =>
      QuizService.deleteQuiz(quizId, userId),
    onSuccess: (_, variables) => {
      // Invalidate quizzes list
      queryClient.invalidateQueries({ 
        queryKey: ['quizzes', variables.userId] 
      });
    },
  });
};
