import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Upload as UploadIcon } from 'lucide-react'
import { useState, useCallback, useEffect, useMemo, Suspense, lazy } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import AppLayout from '@/components/app-layout'
import { useAuth } from '@/context/AuthContextDefinition'
import { useNotes, useDeleteNote } from '@/hooks/useNotes'
import { useUploadPdf } from '@/hooks/useUpload'
import { useJobWebSocket } from '@/hooks/useJobWebSocket'
import { downloadNotePdf } from '@/lib/pdfUtils'
import NotesService from '@/services/NotesService'
import NoteCard from '@/components/notes/NoteCard'

// Lazy load heavy interactive components
const UploadSheet = lazy(() => import('@/components/notes/UploadSheet'))
const DeleteNoteDialog = lazy(() => import('@/components/notes/DeleteNoteDialog'))
const ProcessingDialog = lazy(() => import('@/components/notes/ProcessingDialog'))

export const Route = createFileRoute('/__protected/notes/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: notes = [], isLoading: isLoadingNotes } = useNotes(user?.id)
  const { mutateAsync: deleteNote, isPending: isDeleting } = useDeleteNote()
  const { 
    uploadAsync,
    error: uploadError 
  } = useUploadPdf()
  
  const [open, setOpen] = useState(false)
  const [progressModalOpen, setProgressModalOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string>('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null)
  const [processingJob, setProcessingJob] = useState<{
    jobId: string;
    fileName: string;
    progress: number;
    stage: string;
    status: 'processing' | 'completed' | 'failed';
  } | null>(null)
  
  // WebSocket should only be enabled during active processing
  const [wsEnabled, setWsEnabled] = useState(false)

  const onJobCompleted = useCallback((noteId?: string, stopTrackingFn?: () => void) => {
    console.log('[Notes Page] Job completed with noteId:', noteId);
    
    // Show success state briefly
    setProcessingJob(prev => prev ? { ...prev, status: 'completed', progress: 100 } : null);
    
    // Invalidate queries to refetch fresh data
    queryClient.invalidateQueries({ queryKey: ['notes', user?.id] });
    
    // If we have a noteId, redirect to the note page immediately
    if (noteId) {
      console.log('[Notes Page] Redirecting to note:', noteId);
      
      // Small delay to show success state, then redirect and close modal
      setTimeout(() => {
        setProgressModalOpen(false);
        navigate({ to: '/notes/$noteId', params: { noteId } });
        
        // Clean up everything after redirect
        setProcessingJob(null);
        setSelectedFiles([]);
        setValidationError('');
        
        // Disable WebSocket and unsubscribe after redirect completes
        setWsEnabled(false);
        if (stopTrackingFn) {
          console.log('[Notes Page] Stopping WebSocket tracking after redirect');
          stopTrackingFn();
        }
      }, 1500); // Longer delay to show success message
    } else {
      // Fallback: just clear the processing state and close modal
      setTimeout(() => {
        setProgressModalOpen(false);
        setProcessingJob(null);
        setSelectedFiles([]);
        setValidationError('');
        
        // Disable WebSocket
        setWsEnabled(false);
        if (stopTrackingFn) {
          console.log('[Notes Page] Stopping WebSocket tracking after completion');
          stopTrackingFn();
        }
      }, 2000);
    }
  }, [queryClient, navigate, user?.id]); 

  
  const onJobFailed = useCallback((stopTrackingFn?: () => void) => {
    console.log('[Notes Page] Job failed');
    
    setProcessingJob(prev => prev ? { ...prev, status: 'failed' } : null);
    
    setTimeout(() => {
      setProgressModalOpen(false);
      setProcessingJob(null);
      setSelectedFiles([]);
      setValidationError('');
      
      // Disable WebSocket after failure
      setWsEnabled(false);
      if (stopTrackingFn) {
        console.log('[Notes Page] Stopping WebSocket tracking after failure');
        stopTrackingFn();
      }
    }, 3000);
  }, []);

  
  const { 
    jobProgress, 
    trackJob, 
    stopTracking,
    isConnected,
    usingPolling 
  } = useJobWebSocket({
    userId: user?.id,
    enabled: wsEnabled, // Only enable WebSocket during active processing
    onJobCompleted: (noteId?: string) => onJobCompleted(noteId, stopTracking),
    onJobFailed: () => onJobFailed(stopTracking),
  });

 
  useEffect(() => {
    if (isConnected) {
      console.log('✅ WebSocket connected for real-time job tracking');
    } else if (!isConnected && usingPolling) {
      console.log('🔄 Using polling fallback for job tracking');
    }
  }, [isConnected, usingPolling]);

  // Update processing job with real-time progress
  useEffect(() => {
    if (jobProgress) {
      console.log('📊 [NotesIndex] Received job progress update:', {
        jobId: jobProgress.jobId,
        progress: jobProgress.progress,
        status: jobProgress.status,
        message: jobProgress.message,
        timestamp: jobProgress.timestamp
      });
      
      setProcessingJob(prev => {
        // If no active processing job, create one from the progress update
        if (!prev) {
          console.log('🆕 [NotesIndex] Creating new processing job from progress update');
          return {
            jobId: jobProgress.jobId,
            fileName: 'Processing...',
            progress: Math.min(Math.max(jobProgress.progress || 0, 0), 100),
            stage: jobProgress.message || 'Processing...',
            status: jobProgress.status === 'completed' || jobProgress.status === 'success' ? 'completed' : 
                   jobProgress.status === 'failed' || jobProgress.status === 'error' ? 'failed' : 
                   'processing'
          };
        }
        
        // Ensure we're updating the correct job (allow empty prev.jobId for initial updates)
        if (prev.jobId && jobProgress.jobId && prev.jobId !== jobProgress.jobId) {
          console.warn('⚠️  [NotesIndex] Job ID mismatch, ignoring update:', {
            current: prev.jobId,
            received: jobProgress.jobId
          });
          return prev;
        }
        
        // Log the update
        console.log('✅ [NotesIndex] Updating progress:', {
          from: { progress: prev.progress, stage: prev.stage },
          to: { progress: jobProgress.progress, stage: jobProgress.message }
        });
        
        const newStatus = jobProgress.status === 'completed' || jobProgress.status === 'success' ? 'completed' : 
                         jobProgress.status === 'failed' || jobProgress.status === 'error' ? 'failed' : 
                         'processing';
        
        return {
          ...prev,
          jobId: jobProgress.jobId || prev.jobId, // Update jobId if it was empty
          progress: Math.min(Math.max(jobProgress.progress || 0, 0), 100),
          stage: jobProgress.message || prev.stage || 'Processing...',
          status: newStatus
        };
      });
    }
  }, [jobProgress]);

  // Show an initial skeleton when the page first mounts or when notes are empty.
  const [showInitialSkeleton, setShowInitialSkeleton] = useState(true);

  useEffect(() => {
    if (notes.length > 0) {
      setShowInitialSkeleton(false);
      return;
    }
    if (isLoadingNotes) {
      setShowInitialSkeleton(true);
      return;
    }
    const t = setTimeout(() => setShowInitialSkeleton(false), 300);
    return () => clearTimeout(t);
  }, [isLoadingNotes, notes.length]);

  const shouldShowSkeletonOnly = notes.length === 0 && (isLoadingNotes || showInitialSkeleton);
  const isEmptyStateVisible = notes.length === 0 && !isLoadingNotes && !showInitialSkeleton && !processingJob;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(file => file.type === 'application/pdf')
      if (files.length !== e.target.files.length) {
        setValidationError('Only PDF files are allowed')
      } else {
        setValidationError('')
      }
      setSelectedFiles(prev => [...prev, ...files])
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf')
      if (files.length !== e.dataTransfer.files.length) {
        setValidationError('Only PDF files are allowed')
      } else {
        setValidationError('')
      }
      setSelectedFiles(prev => [...prev, ...files])
    }
  }, [])

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    if (selectedFiles.length <= 1) {
      setValidationError('')
    }
  }, [selectedFiles.length])

  // File size validation: disable generate when any file > 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes
  const hasFileTooLarge = useMemo(() => selectedFiles.some(f => f.size > MAX_FILE_SIZE), [selectedFiles, MAX_FILE_SIZE])

  useEffect(() => {
    // Only set the size error if present; otherwise don't overwrite other validation messages
    if (hasFileTooLarge) {
      setValidationError('One or more files exceed the 10MB limit')
    } else if (validationError === 'One or more files exceed the 10MB limit') {
      setValidationError('')
    }
  }, [hasFileTooLarge, validationError])

  const handleGenerateNotes = async () => {
    if (!user?.id) {
      alert('You must be logged in to upload files')
      return
    }

    if (selectedFiles.length === 0) {
      setValidationError('Please select at least one PDF file')
      return
    } 

    // For now, we'll process only the first file
    const file = selectedFiles[0]

    try {
      // Enable WebSocket for this processing session
      console.log('[Notes Page] Enabling WebSocket for processing');
      setWsEnabled(true);
      
      // Initialize processing job state FIRST
      setProcessingJob({
        jobId: '',
        fileName: file.name,
        progress: 0,
        stage: 'Initializing upload...',
        status: 'processing'
      });
      
      // Close the upload drawer and open progress modal
      setOpen(false)
      setProgressModalOpen(true)
      
      // Upload and process the PDF first to get jobId
      const result = await uploadAsync({
        file,
        userId: user.id,
        fileName: file.name.replace('.pdf', '')
      })

      // Track the job with WebSocket/polling IMMEDIATELY
      // Prefer optimized job ID if available
      const jobIdToTrack = result?.uploadResult?.optimizedJobId || result?.uploadResult?.jobId;
      
      if (jobIdToTrack) {
        console.log('[NotesIndex] Tracking job:', jobIdToTrack);
        
        // Update processing job state with the actual jobId
        setProcessingJob({
          jobId: jobIdToTrack,
          fileName: file.name,
          progress: 5,
          stage: 'Upload complete, starting processing...',
          status: 'processing'
        });
        
        // Subscribe to job-specific room immediately to catch any progress
        trackJob(jobIdToTrack);
      } else {
        console.error('[NotesIndex] No jobId returned from upload');
        throw new Error('Failed to start processing job');
      }

      // Success is handled by the WebSocket/polling callbacks
      
    } catch (error: unknown) {
      console.error('Failed to generate notes:', error)
      
      // Show error state
      const errorMessage = (error as { message?: string }).message || 'Unknown error';
      setProcessingJob({
        jobId: '',
        fileName: selectedFiles[0]?.name || 'Unknown',
        progress: 0,
        stage: errorMessage,
        status: 'failed'
      });
      
      // Reset states after showing error
      setTimeout(() => {
        setProgressModalOpen(false);
        setProcessingJob(null);
        stopTracking();
        setSelectedFiles([]);
        setValidationError('');
        
        // Disable WebSocket and clean up on error
        setWsEnabled(false);
        console.log('[Notes Page] WebSocket disabled after upload error');
      }, 3000);
    }
  }

  const handleDownloadNote = useCallback(async (noteId: string, title: string, content: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      downloadNotePdf(title, content);
      console.log('Downloaded note as PDF:', noteId);
    } catch (error) {
      console.error('Failed to download note:', error);
    }
  }, []);

  const handleDeleteNote = async (noteId: string) => {
    if (!user?.id) {
      alert('You must be logged in to delete notes');
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
      return;
    }
    
    try {
      await deleteNote({ noteId, userId: user.id });
      console.log('Successfully deleted note:', noteId);
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    } catch (error) {
      console.error('Failed to delete note:', error);
      // Keep dialog open on error so user can retry
      alert('Failed to delete note. Please try again.');
    }
  };

  const openDeleteDialog = useCallback((noteId: string, noteTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setNoteToDelete({ id: noteId, title: noteTitle });
    setDeleteDialogOpen(true);
  }, []);

  // Prefetch note data on hover for instant navigation
  const handlePrefetchNote = useCallback((noteId: string) => {
    if (user?.id) {
      queryClient.prefetchQuery({
        queryKey: ['note', noteId, user.id],
        queryFn: () => NotesService.getNote(noteId, user.id),
        staleTime: 1000 * 60 * 5, // 5 minutes
      })
    }
  }, [user?.id, queryClient])

  const handleProcessingDialogChange = useCallback((open: boolean) => {
    // Only allow closing if job is completed or failed
    if (!open && processingJob?.status === 'processing') {
      console.log('⚠️ Prevented modal close during processing');
      return; // Prevent closing during processing
    }
    setProgressModalOpen(open);
    // If closing and job is done, clean up
    if (!open) {
      // Disable WebSocket when manually closing modal
      setWsEnabled(false);
      stopTracking();
      console.log('[Notes Page] WebSocket disabled - modal closed manually');
      
      setTimeout(() => {
        setProcessingJob(null);
        setSelectedFiles([]);
        setValidationError('');
      }, 300);
    }
  }, [processingJob?.status, stopTracking]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto py-8 space-y-8 mt-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Study Notes</h1>
          <p className="text-muted-foreground mt-1 text-lg">AI-generated study notes from your lecture materials</p>
        </div>
        <div className="flex gap-3">
          <Button 
            size="lg" 
            className="gap-2 shadow-sm hover:shadow-md transition-all" 
            onClick={() => setOpen(true)}
          >
            <UploadIcon className="h-5 w-5" />
            Upload PDF
          </Button>
          
          <Suspense fallback={null}>
            <UploadSheet 
              open={open}
              onOpenChange={setOpen}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              isDragging={isDragging}
              onFileChange={handleFileChange}
              selectedFiles={selectedFiles}
              onRemoveFile={removeFile}
              validationError={validationError}
              uploadError={uploadError || null}
              onGenerate={handleGenerateNotes}
              hasFileTooLarge={hasFileTooLarge}
            />
          </Suspense>
        </div>
      </div>

      {/* Notes Grid */}
      {shouldShowSkeletonOnly ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Skeleton Loading Cards */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-full border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-2 flex-1 min-w-0">
                    <Skeleton className="h-6 w-3/4" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 mb-6 mt-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <div className="flex items-center justify-between pt-4 border-t">
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Existing Notes */}
          {notes.map((note) => (
            <NoteCard 
              key={note.id} 
              note={note} 
              navigate={navigate}
              onDownload={handleDownloadNote}
              onDelete={openDeleteDialog}
              onPrefetch={handlePrefetchNote}
            />
          ))}
        </div>
      ) : isEmptyStateVisible ? (
        <div className="flex flex-col items-center justify-center py-24 bg-card rounded-xl border border-dashed">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <FileText className="h-10 w-10 text-primary" />
          </div>
          <h3 className="font-bold text-2xl mb-2 text-foreground">No study notes yet</h3>
          <p className="text-muted-foreground mb-8 text-center max-w-md text-base">
            Upload your lecture PDFs to generate comprehensive, AI-powered study notes that help you learn faster and retain more.
          </p>
          <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-all" onClick={() => setOpen(true)}>
            <UploadIcon className="h-5 w-5" />
            Upload Your First PDF
          </Button>
        </div>
      ) : null }
    </div>

    {/* Progress Modal */}
    <Suspense fallback={null}>
      <ProcessingDialog 
        open={progressModalOpen}
        onOpenChange={handleProcessingDialogChange}
        processingJob={processingJob}
        isConnected={isConnected}
        usingPolling={usingPolling}
      />
    </Suspense>

    {/* Delete Confirmation Dialog */}
    <Suspense fallback={null}>
      <DeleteNoteDialog 
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        noteTitle={noteToDelete?.title}
        isDeleting={isDeleting}
        onConfirm={(e) => {
          e.preventDefault();
          if (noteToDelete) handleDeleteNote(noteToDelete.id);
        }}
        onCancel={() => {
          setNoteToDelete(null);
          setDeleteDialogOpen(false);
        }}
      />
    </Suspense>
    </AppLayout>
  )
}
