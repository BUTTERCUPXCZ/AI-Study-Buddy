import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { FileText, Download, Upload as UploadIcon, X, AlertCircle, Loader2, Wifi, WifiOff, CheckCircle2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useState, useCallback, useEffect } from 'react'
import AppLayout from '@/components/app-layout'
import { useAuth } from '@/context/AuthContext'
import { useNotes } from '@/hooks/useNotes'
import { useUploadPdf } from '@/hooks/useUpload'
import { useJobWebSocket } from '@/hooks/useJobWebSocket'

export const Route = createFileRoute('/__protected/notes/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: notes = [], isLoading: isLoadingNotes, refetch: refetchNotes } = useNotes(user?.id)
  const { 
    uploadAsync,
    error: uploadError 
  } = useUploadPdf()
  
  const [open, setOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string>('')
  const [processingJob, setProcessingJob] = useState<{
    jobId: string;
    fileName: string;
    progress: number;
    stage: string;
    status: 'processing' | 'completed' | 'failed';
  } | null>(null)

  // Wrap onJobCompleted in useCallback
  const onJobCompleted = useCallback(() => {
    console.log('[Notes Page] Job completed!');
    
    // Show success state briefly
    setProcessingJob(prev => prev ? { ...prev, status: 'completed', progress: 100 } : null);
    
    // Refetch notes
    refetchNotes();
    
    // Clear processing job after animation
    setTimeout(() => {
      setProcessingJob(null);
      setSelectedFiles([]);
      setValidationError('');
    }, 2000);
  }, [refetchNotes]); 

  // Wrap onJobFailed in useCallback
  const onJobFailed = useCallback(() => {
    console.log('[Notes Page] Job failed');
    
    setProcessingJob(prev => prev ? { ...prev, status: 'failed' } : null);
    
    setTimeout(() => {
      setProcessingJob(null);
      setSelectedFiles([]);
      setValidationError('');
    }, 3000);
  }, []);

  // WebSocket connection for job tracking
  const { 
    jobProgress, 
    trackJob, 
    stopTracking,
    isConnected,
    usingPolling 
  } = useJobWebSocket({
    userId: user?.id,
    enabled: true, // Keep WebSocket connected throughout the session
    onJobCompleted: onJobCompleted,
    onJobFailed: onJobFailed,
  });

  // Update processing job with real-time progress
  useEffect(() => {
    if (jobProgress && processingJob) {
      setProcessingJob(prev => prev ? {
        ...prev,
        progress: jobProgress.progress,
        stage: jobProgress.message || prev.stage,
        status: jobProgress.status === 'completed' ? 'completed' : 
                jobProgress.status === 'failed' ? 'failed' : 'processing'
      } : null);
    }
  }, [jobProgress, processingJob]);

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
      
    } catch (error: any) {
      console.error('Failed to generate notes:', error)
      
      // Show error state
      setProcessingJob(prev => prev ? { ...prev, status: 'failed', stage: error.message } : null);
      
      // Reset states after showing error
      setTimeout(() => {
        setProcessingJob(null);
        stopTracking();
        setSelectedFiles([]);
        setValidationError('');
      }, 3000);
    }
  }
  
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

  return (
    <AppLayout>
      
      <div className="space-y-6 mt-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Study Notes</h2>
          <p className="text-muted-foreground mt-1">AI-generated study notes from your lecture materials</p>
        </div>
        <div className="flex gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="lg" className="gap-2">
                <UploadIcon className="h-4 w-4" />
                Upload PDF
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Upload Lecture PDF's</SheetTitle>
                <SheetDescription>
                  Upload your lecture PDF files to generate AI-powered study notes
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Upload Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                    isDragging 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <UploadIcon className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Drop your PDF files here</h3>
                      <p className="text-sm text-muted-foreground">or click to browse from your computer</p>
                    </div>
                    <label htmlFor="file-upload">
                      <Button type="button" onClick={() => document.getElementById('file-upload')?.click()}>
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
                    <p className="text-xs text-muted-foreground">Supports: PDF files up to 10MB each</p>
                  </div>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Selected Files ({selectedFiles.length})</h4>
                    <div className="space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
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
                            className="shrink-0"
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
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p className="text-sm">{validationError || uploadError}</p>
                  </div>
                )}

                {/* Generate Button */}
                <Button 
                  className="w-full" 
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
      {isLoadingNotes ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : notes.length > 0 || processingJob ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Processing Job Card */}
          {processingJob && (
            <Card className={`h-full border-2 ${
              processingJob.status === 'completed' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
              processingJob.status === 'failed' ? 'border-red-500 bg-red-50 dark:bg-red-950/20' :
              'border-primary bg-primary/5 animate-pulse'
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
                    <div className="flex items-center gap-2">
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
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <Wifi className="h-3 w-3" />
                          Live
                        </span>
                      )}
                      {usingPolling && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <WifiOff className="h-3 w-3" />
                          Polling
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {processingJob.status === 'processing' && (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{getStageMessage(processingJob.stage)}</span>
                        <span>{Math.round(processingJob.progress)}%</span>
                      </div>
                      <Progress value={processingJob.progress} className="h-2" />
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      💡 Gemini AI is reading your PDF directly for the best understanding!
                    </p>
                  </>
                )}
                {processingJob.status === 'completed' && (
                  <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                    ✓ Study notes generated successfully! Refreshing list...
                  </p>
                )}
                {processingJob.status === 'failed' && (
                  <p className="text-sm text-red-700 dark:text-red-400">
                    ✗ Failed to process PDF. Please try again.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Existing Notes */}
          {notes.map((note) => (
            <Card 
              key={note.id} 
              className="h-full hover:shadow-xl hover:scale-[1.02] hover:border-primary/50 transition-all duration-300 bg-card/50 backdrop-blur cursor-pointer overflow-hidden group"
              onClick={() => {
                console.log('Navigating to note:', note.id)
                navigate({ 
                  to: '/notes/$noteId', 
                  params: { noteId: note.id } 
                })
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <CardTitle className="text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                      {note.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-medium">
                        {note.source ? 'PDF' : 'Manual'}
                      </Badge>
                      <CardDescription className="text-xs">
                        {formatDate(note.createdAt)}
                      </CardDescription>
                    </div>
                  </div>
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground line-clamp-4 mb-4 leading-relaxed">
                  {getExcerpt(note.content, 150)}
                </p>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    View details →
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 hover:bg-primary/10"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      // Handle download or export
                      console.log('Download note:', note.id)
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-2 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <FileText className="h-12 w-12 text-primary" />
            </div>
            <h3 className="font-semibold text-2xl mb-2">No study notes yet</h3>
            <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
              Upload your lecture PDFs to generate comprehensive, AI-powered study notes that help you learn faster and retain more.
            </p>
            <Button size="lg" className="gap-2" onClick={() => setOpen(true)}>
              <UploadIcon className="h-4 w-4" />
              Upload Your First PDF
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
    </AppLayout>
  )
}
 
