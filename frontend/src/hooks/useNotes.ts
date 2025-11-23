import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NotesService from '@/services/NotesService';

export const useNotes = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['notes', userId],
    queryFn: () => NotesService.getUserNotes(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 10, // Cache for 10 minutes (formerly cacheTime)
    refetchOnMount: 'always', // Always refetch on mount for fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnReconnect: true, // Refetch when connection is restored
  });
};

export const useNote = (noteId: string, userId: string) => {
  return useQuery({
    queryKey: ['note', noteId, userId],
    queryFn: () => NotesService.getNote(noteId, userId),
    enabled: !!noteId && !!userId,
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 10, // Cache for 10 minutes
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
};

export const useUpdateNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, userId, data }: { 
      noteId: string; 
      userId: string; 
      data: { title?: string; content?: string } 
    }) => NotesService.updateNote(noteId, userId, data),
    // Optimistic update for better UX
    onMutate: async ({ noteId, userId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['note', noteId, userId] });
      await queryClient.cancelQueries({ queryKey: ['notes', userId] });

      // Snapshot the previous value
      const previousNote = queryClient.getQueryData(['note', noteId, userId]);
      const previousNotes = queryClient.getQueryData(['notes', userId]);

      // Optimistically update to the new value
      if (previousNote) {
        queryClient.setQueryData(['note', noteId, userId], (old: Record<string, unknown>) => ({
          ...old,
          ...data,
        }));
      }

      // Return a context object with the snapshotted values
      return { previousNote, previousNotes };
    },
    onError: (_, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousNote) {
        queryClient.setQueryData(['note', variables.noteId, variables.userId], context.previousNote);
      }
      if (context?.previousNotes) {
        queryClient.setQueryData(['notes', variables.userId], context.previousNotes);
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch notes after successful update
      queryClient.invalidateQueries({ queryKey: ['notes', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['note', variables.noteId, variables.userId] });
    },
  });
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, userId }: { noteId: string; userId: string }) =>
      NotesService.deleteNote(noteId, userId),
    // Optimistic update for delete
    onMutate: async ({ noteId, userId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notes', userId] });

      // Snapshot the previous value
      const previousNotes = queryClient.getQueryData(['notes', userId]);

      // Optimistically remove the note
      queryClient.setQueryData(['notes', userId], (old: { id: string }[]) =>
        old ? old.filter(note => note.id !== noteId) : []
      );

      return { previousNotes };
    },
    onError: (_, variables, context) => {
      // If the mutation fails, roll back
      if (context?.previousNotes) {
        queryClient.setQueryData(['notes', variables.userId], context.previousNotes);
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['notes', variables.userId] });
      // Remove the individual note from cache
      queryClient.removeQueries({ queryKey: ['note', variables.noteId, variables.userId] });
    },
  });
};
