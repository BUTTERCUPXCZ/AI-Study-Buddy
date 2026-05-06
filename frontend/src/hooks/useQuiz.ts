import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QuizService from '@/services/QuizService';

// userId stays in the query key for cache scoping; service calls derive
// userId server-side from the auth cookie.
export const useQuizzes = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['quizzes', userId],
    queryFn: () => QuizService.getUserQuizzes(),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

export const useQuiz = (quizId: string, userId: string | undefined) => {
  return useQuery({
    queryKey: ['quiz', quizId, userId],
    queryFn: () => QuizService.getQuiz(quizId),
    enabled: !!quizId && !!userId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

export const useGenerateQuizFromNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      noteTitle,
      noteContent,
    }: {
      noteId: string;
      userId: string;
      noteTitle: string;
      noteContent: string;
    }) => QuizService.generateQuizFromNote(noteId, noteTitle, noteContent),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes', variables.userId] });
    },
  });
};

export const useUpdateQuizScore = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      score,
    }: {
      quizId: string;
      userId: string;
      score: number;
    }) => QuizService.updateQuizScore(quizId, score),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['quiz', variables.quizId, variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ['quizzes', variables.userId],
      });
    },
  });
};

export const useDeleteQuiz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId }: { quizId: string; userId: string }) =>
      QuizService.deleteQuiz(quizId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['quizzes', variables.userId],
      });
    },
  });
};
