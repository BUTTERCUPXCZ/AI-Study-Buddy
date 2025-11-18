import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NotesService from '@/services/NotesService';

export const useNotes = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['notes', userId],
    queryFn: () => NotesService.getUserNotes(userId!),
    enabled: !!userId,
    staleTime: 0, // Always refetch when invalidated
    refetchOnMount: true, // Refetch when component mounts
  });
};

export const useNote = (noteId: string, userId: string) => {
  return useQuery({
    queryKey: ['note', noteId, userId],
    queryFn: () => NotesService.getNote(noteId, userId),
    enabled: !!noteId && !!userId,
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
    onSuccess: (_, variables) => {
      // Invalidate and refetch notes
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
    onSuccess: (_, variables) => {
      // Invalidate and refetch notes
      queryClient.invalidateQueries({ queryKey: ['notes', variables.userId] });
    },
  });
};
