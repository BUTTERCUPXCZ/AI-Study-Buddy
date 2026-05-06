import { memo, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ProgressBar } from '@/components/ProgressBar'

interface ProcessingJob {
  jobId: string
  fileName: string
  progress: number
  stage: string
  status: 'processing' | 'completed' | 'failed'
}

interface ProcessingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  processingJob: ProcessingJob | null
  isConnected: boolean
  usingPolling: boolean
  /**
   * Live AI text streaming in from the worker. When non-empty the
   * dialog hides the progress bar and shows the typing preview instead.
   */
  streamedNotes?: string
}

const ProcessingDialog = memo(({
  open,
  onOpenChange,
  processingJob,
  isConnected,
  usingPolling,
  streamedNotes
}: ProcessingDialogProps) => {
  const streamRef = useRef<HTMLDivElement>(null)

  // Auto-scroll the preview to the bottom as new chunks arrive so the
  // user always sees the freshly-typed text.
  useEffect(() => {
    if (!streamedNotes) return
    const el = streamRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [streamedNotes])

  const showStream =
    !!streamedNotes &&
    streamedNotes.length > 0 &&
    processingJob?.status === 'processing'

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        className="sm:max-w-2xl border-2 p-0"
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking outside during processing
          if (processingJob?.status === 'processing') {
            e.preventDefault();
            console.log('⚠️ Prevented modal close from outside click during processing');
          }
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with Escape key during processing
          if (processingJob?.status === 'processing') {
            e.preventDefault();
            console.log('⚠️ Prevented modal close from Escape key during processing');
          }
        }}
      >
        <DialogTitle className="sr-only">
          {processingJob?.status === 'completed' ? 'Processing Complete' :
           processingJob?.status === 'failed' ? 'Processing Failed' :
           'Processing Document'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {processingJob?.stage || 'Processing your document. Please wait...'}
        </DialogDescription>
        <div className={processingJob?.status === 'processing' ? '[&~button]:hidden' : ''}>
          {processingJob ? (
            showStream ? (
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-semibold truncate"
                      title={processingJob.fileName}
                    >
                      {processingJob.fileName}
                    </p>
                    {/* Live backend stage — surfaces what server is
                        doing (uploaded → thinking → streaming → saving). */}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {processingJob.stage || 'Generating notes…'}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      isConnected
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {isConnected ? 'Live' : 'Polling'}
                  </span>
                </div>
                <div
                  ref={streamRef}
                  className="h-72 overflow-y-auto rounded-md border bg-muted/30 px-4 py-3 text-sm font-mono whitespace-pre-wrap leading-relaxed"
                >
                  {streamedNotes}
                  <span className="inline-block w-2 h-4 ml-0.5 bg-primary align-middle animate-pulse" />
                </div>
              </div>
            ) : (
              <ProgressBar
                progress={processingJob.progress}
                stage={processingJob.stage}
                fileName={processingJob.fileName}
                status={processingJob.status}
                isConnected={isConnected}
                usingPolling={usingPolling}
              />
            )
          ) : (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
})

export default ProcessingDialog
