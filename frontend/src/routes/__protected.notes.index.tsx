import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Download, Upload as UploadIcon, X, AlertCircle, Loader2, Wifi, WifiOff, CheckCircle2, MoreVertical, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useState, useCallback, useEffect, memo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import AppLayout from '@/components/app-layout'
import { useAuth } from '@/context/AuthContextDefinition'
import { useNotes, useDeleteNote } from '@/hooks/useNotes'
import { useUploadPdf } from '@/hooks/useUpload'
import { useJobWebSocket } from '@/hooks/useJobWebSocket'
import { downloadNotePdf } from '@/lib/pdfUtils'
import NotesService from '@/services/NotesService'

// Helper functions
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const getExcerpt = (content: string, maxLength: number = 100) => {
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength) + '...'
}

const getStageMessage = (stage: string) => {
  if (!stage) return 'Processing your document...';
  
  switch (stage.toLowerCase()) {
    case 'processing':
    case 'uploading':
      return 'Processing your PDF...';
    case 'uploading_to_gemini':
      return 'Uploading PDF to Gemini AI...';
    case 'generating_notes':
    case 'generating notes':
    case 'gemini is analyzing your pdf and generating study notes...':
      return 'Gemini is analyzing your PDF...';
    case 'saving_notes':
    case 'saving notes':
      return 'Saving your generated notes...';
    case 'completed':
    case 'complete':
      return 'Completed! ✓';
    default:
      return stage;
  }
};

// Memoized Components
const ProcessingJobCard = memo(({ 
  processingJob, 
  usingPolling, 
  isConnected 
}: { 
  processingJob: { status: string; fileName: string; stage?: string; progress: number }, 
  usingPolling: boolean, 
  isConnected: boolean 
}) => (
  <Card className={`h-full border-2 shadow-md ${
    processingJob.status === 'completed' ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/10' :
    processingJob.status === 'failed' ? 'border-red-500/50 bg-red-50/50 dark:bg-red-950/10' :
    'border-primary/50 bg-primary/5 animate-pulse'
  } transition-all duration-300`}>
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 flex-1 min-w-0">
          <CardTitle className="text-lg font-semibold line-clamp-2 flex items-center gap-2">
            {processingJob.status === 'completed' ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                {processingJob.fileName}
              </>
            ) : processingJob.status === 'failed' ? (
              <>
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                {processingJob.fileName}
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                {processingJob.fileName}
              </>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={
              processingJob.status === 'completed' ? 'default' :
              processingJob.status === 'failed' ? 'destructive' :
              'secondary'
            } className="text-xs font-medium">
              {processingJob.status === 'completed' ? 'Completed' :
               processingJob.status === 'failed' ? 'Failed' :
               'Processing'}
            </Badge>
            {!usingPolling && isConnected && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                <Wifi className="h-3 w-3" />
                Live
              </span>
            )}
            {usingPolling && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <WifiOff className="h-3 w-3" />
                Polling
              </span>
            )}
          </div>
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-2 space-y-4">
      {processingJob.status === 'processing' && (
        <>
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>{getStageMessage(processingJob.stage || '')}</span>
              <span>{Math.round(processingJob.progress)}%</span>
            </div>
            <Progress value={processingJob.progress} className="h-2" />
          </div>
          <p className="text-xs text-muted-foreground italic bg-background/50 p-2 rounded border">
            💡 Gemini AI is reading your PDF directly for the best understanding!
          </p>
        </>
      )}
      {processingJob.status === 'completed' && (
        <p className="text-sm text-green-700 dark:text-green-400 font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Study notes generated successfully! Refreshing list...
        </p>
      )}
      {processingJob.status === 'failed' && (
        <p className="text-sm text-red-700 dark:text-red-400 font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Failed to process PDF. Please try again.
        </p>
      )}
    </CardContent>
  </Card>
));

const NoteCard = memo(({ 
  note, 
  navigate, 
  onDownload, 
  onDelete,
  onPrefetch
}: { 
  note: { id: string; title: string; content: string; source?: string; createdAt: string }, 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigate: (opts: any) => void, 
  onDownload: (id: string, title: string, content: string, e: React.MouseEvent) => void,
  onDelete: (id: string, title: string, e: React.MouseEvent) => void,
  onPrefetch: (noteId: string) => void
}) => (
  <Card 
    className="h-full flex flex-col hover:shadow-lg hover:border-primary/30 transition-all duration-300 bg-card cursor-pointer overflow-hidden group border-border/60"
    onMouseEnter={() => onPrefetch(note.id)}
    onClick={() => {
      console.log('Navigating to note:', note.id)
      navigate({ 
        to: '/notes/$noteId', 
        params: { noteId: note.id } 
      })
    }}
  >
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1 min-w-0">
          <CardTitle className="text-lg font-bold line-clamp-2 group-hover:text-primary transition-colors leading-tight">
            {note.title}
          </CardTitle>  
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs font-medium bg-secondary/50 text-secondary-foreground">
              {note.source ? 'PDF' : 'Manual'}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
              {formatDate(note.createdAt)}
            </span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-primary/10 -mr-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={(e) => onDownload(note.id, note.title, note.content, e)}
              className="cursor-pointer"
            >
              <Download className="mr-2 h-4 w-4" />
              <span>Download as PDF</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => onDelete(note.id, note.title, e)}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete Note</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </CardHeader>
    <CardContent className="pt-0 flex-1 flex flex-col">
      <p className="text-sm text-muted-foreground line-clamp-4 mb-6 leading-relaxed flex-1">
        {getExcerpt(note.content, 150)}
      </p>
      <div className="flex items-center justify-between pt-4 border-t mt-auto">
        <span className="text-xs font-medium text-primary group-hover:underline underline-offset-4">
          View details
        </span>
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <FileText className="h-3 w-3 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
));

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
  // Control WebSocket connection - only enable when processing
  // This prevents unnecessary connection delays when just browsing notes
  const [enableWebSocket, setEnableWebSocket] = useState(false)

  // Wrap onJobCompleted in useCallback
  const onJobCompleted = useCallback((noteId?: string) => {
    console.log('[Notes Page] Job completed with noteId:', noteId);
    
    // Show success state briefly
    setProcessingJob(prev => prev ? { ...prev, status: 'completed', progress: 100 } : null);
    
    // Invalidate queries to refetch fresh data
    queryClient.invalidateQueries({ queryKey: ['notes', user?.id] });
    
    // Ensure modal is closed
    setOpen(false);
    
    // If we have a noteId, redirect to the note page immediately
    if (noteId) {
      console.log('[Notes Page] Redirecting to note:', noteId);
      
      // Small delay to show success state, then redirect
      setTimeout(() => {
        navigate({ to: '/notes/$noteId', params: { noteId } });
        
        // Clear processing job and disable WebSocket after redirect
        setProcessingJob(null);
        setSelectedFiles([]);
        setValidationError('');
        setEnableWebSocket(false);
      }, 500); // Short delay to show success message
    } else {
      // Fallback: just clear the processing state if no noteId
      setTimeout(() => {
        setProcessingJob(null);
        setSelectedFiles([]);
        setValidationError('');
        setEnableWebSocket(false);
      }, 2000);
    }
  }, [queryClient, navigate, user?.id]); 

  // Wrap onJobFailed in useCallback
  const onJobFailed = useCallback(() => {
    console.log('[Notes Page] Job failed');
    
    setProcessingJob(prev => prev ? { ...prev, status: 'failed' } : null);
    
    // Ensu re modal is closed
    setOpen(false);
    
    setTimeout(() => {
      setProcessingJob(null);
      setSelectedFiles([]);
      setValidationError('');
      setEnableWebSocket(false); // Disconnect WebSocket after failure
    }, 3000);
  }, []);

  // WebSocket connection for job tracking - LAZY CONNECTION
  const { 
    jobProgress, 
    trackJob, 
    stopTracking,
    isConnected,
    usingPolling 
  } = useJobWebSocket({
    userId: user?.id,
    enabled: enableWebSocket, // Only connect when actively processing
    onJobCompleted: onJobCompleted,
    onJobFailed: onJobFailed,
  });

  // Log WebSocket connection state changes
  useEffect(() => {
    if (enableWebSocket && isConnected) {
      console.log('✅ WebSocket connected for real-time job tracking');
    } else if (enableWebSocket && !isConnected && usingPolling) {
      console.log('🔄 Using polling fallback for job tracking');
    }
  }, [enableWebSocket, isConnected, usingPolling]);

  // Update processing job with real-time progress
  useEffect(() => {
    if (jobProgress) {
      setProcessingJob(prev => {
        // Only update if we have an active processing job
        if (!prev) return null;
        
        return {
          ...prev,
          progress: jobProgress.progress,
          stage: jobProgress.message || prev.stage,
          status: jobProgress.status === 'completed' ? 'completed' : 
                  jobProgress.status === 'failed' ? 'failed' : 'processing'
        };
      });
    }
  }, [jobProgress]); // Remove processingJob from dependencies to avoid infinite loop

  // Show an initial skeleton when the page first mounts or when notes are empty.
  // This ensures users see the loading skeleton first (briefly) even if the
  // notes array is empty immediately from the hook.
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(file => file.type === 'application/pdf')
      if (files.length !== e.target.files.length) {
        setValidationError('Only PDF files are allowed')
      } else {
        setValidationError('')
      }
      setSelectedFiles(prev => [...prev, ...files])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
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
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    if (selectedFiles.length <= 1) {
      setValidationError('')
    }
  }

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
      setOpen(false) // Close the upload drawer
      
      // Set processing job state
      setProcessingJob({
        jobId: '',
        fileName: file.name,
        progress: 0,
        stage: 'Uploading PDF...',
        status: 'processing'
      });

      // Enable WebSocket connection now that we're processing
      setEnableWebSocket(true);

      // Upload and process the PDF
      const result = await uploadAsync({
        file,
        userId: user.id,
        fileName: file.name.replace('.pdf', '')
      })

      // Track the job with WebSocket/polling
      if (result?.uploadResult?.jobId) {
        setProcessingJob(prev => prev ? { ...prev, jobId: result.uploadResult.jobId } : null);
        trackJob(result.uploadResult.jobId);
      }

      // Success is handled by the WebSocket/polling callbacks
      
    } catch (error: unknown) {
      console.error('Failed to generate notes:', error)
      
      // Show error state
      const errorMessage = (error as { message?: string }).message || 'Unknown error';
      setProcessingJob(prev => prev ? { ...prev, status: 'failed', stage: errorMessage } : null);
      
      // Reset states after showing error
      setTimeout(() => {
        setProcessingJob(null);
        stopTracking();
        setSelectedFiles([]);
        setValidationError('');
        setEnableWebSocket(false); // Disconnect WebSocket after error
      }, 3000);
    }
  }
  
  // Helper functions extracted for performance
  // Helper functions are now outside the component
  // const formatDate = ...
  // const getExcerpt = ...
  // const getStageMessage = ...

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

  return (
    <AppLayout>
      
      <div className="max-w-7xl mx-auto py-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Study Notes</h1>
          <p className="text-muted-foreground mt-1 text-lg">AI-generated study notes from your lecture materials</p>
        </div>
        <div className="flex gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="lg" className="gap-2 shadow-sm hover:shadow-md transition-all">
                <UploadIcon className="h-5 w-5" />
                Upload PDF
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-2xl">Upload Lecture PDF's</SheetTitle>
                <SheetDescription className="text-base">
                  Upload your lecture PDF files to generate AI-powered study notes
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-8 space-y-6">
                {/* Upload Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
                    isDragging 
                      ? 'border-primary bg-primary/5 scale-[1.02]' 
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                      <UploadIcon className="h-10 w-10 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Drop your PDF files here</h3>
                      <p className="text-sm text-muted-foreground">or click to browse from your computer</p>
                    </div>
                    <label htmlFor="file-upload">
                      <Button type="button" variant="outline" className="mt-4" onClick={() => document.getElementById('file-upload')?.click()}>
                        Choose Files
                      </Button>
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <p className="text-xs text-muted-foreground mt-4">Supports: PDF files up to 10MB each</p>
                  </div>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <h4 className="font-semibold text-sm text-foreground">Selected Files ({selectedFiles.length})</h4>
                    <div className="space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between p-3 bg-card border rounded-lg shadow-sm"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {(validationError || uploadError) && (
                  <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-lg animate-in fade-in slide-in-from-bottom-2">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">{validationError || uploadError}</p>
                  </div>
                )}

                {/* Generate Button */}
                <Button 
                  className="w-full h-12 text-base font-medium shadow-md hover:shadow-lg transition-all" 
                  size="lg"
                  onClick={handleGenerateNotes}
                  disabled={selectedFiles.length === 0}
                >
                  Generate Study Notes
                </Button>
              </div>
            </SheetContent>
          </Sheet>
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
  ) : notes.length > 0 || processingJob ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Processing Job Card */}
          {processingJob && (
            <ProcessingJobCard 
              processingJob={processingJob}
              usingPolling={usingPolling}
              isConnected={isConnected}
            />
          )}
          
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

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you wa nt to delete this note?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete "<strong>{noteToDelete?.title}</strong>". This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => {
              setNoteToDelete(null);
              setDeleteDialogOpen(false);
            }}
            disabled={isDeleting}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              if (noteToDelete) handleDeleteNote(noteToDelete.id);
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </AppLayout>
  )
}

