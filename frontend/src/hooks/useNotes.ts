import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NotesService from '@/services/NotesService';

// userId is kept in the query key for cache scoping; the service call
// derives userId server-side from the auth cookie.
export const useNotes = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['notes', userId],
    queryFn: () => NotesService.getUserNotes(),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};

export const useNote = (noteId: string, userId: string) => {
  return useQuery({
    queryKey: ['note', noteId, userId],
    queryFn: () => NotesService.getNote(noteId),
    enabled: !!noteId && !!userId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};


export const useDeleteNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId }: { noteId: string; userId: string }) =>
      NotesService.deleteNote(noteId),
    onMutate: async ({ noteId, userId }) => {
      await queryClient.cancelQueries({ queryKey: ['notes', userId] });

      const previousNotes = queryClient.getQueryData(['notes', userId]);

      queryClient.setQueryData(['notes', userId], (old: { id: string }[]) =>
        old ? old.filter(note => note.id !== noteId) : []
      );

      return { previousNotes };
    },
    onError: (_, variables, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(['notes', variables.userId], context.previousNotes);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes', variables.userId] });
      queryClient.removeQueries({ queryKey: ['note', variables.noteId, variables.userId] });
    },
  });
};
