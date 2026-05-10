import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TutorService from '@/services/TutorService';

export const useTutorSessions = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['tutor-sessions', userId],
    queryFn: () => TutorService.getUserChatSessions(),
    enabled: !!userId,
  });
};

export const useTutorSession = (sessionId: string, userId: string) => {
  return useQuery({
    queryKey: ['tutor-session', sessionId, userId],
    queryFn: () => TutorService.getChatSession(sessionId),
    enabled: !!sessionId && !!userId,
  });
};

export const useUpdateSessionTitle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      title,
    }: {
      sessionId: string;
      userId: string;
      title: string;
    }) => TutorService.updateChatSessionTitle(sessionId, title),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tutor-sessions', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['tutor-session', variables.sessionId, variables.userId] });
    },
  });
};

export const useDeleteSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
    }: {
      sessionId: string;
      userId: string;
    }) => TutorService.deleteChatSession(sessionId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tutor-sessions', variables.userId] });
    },
  });
};
