import { memo } from 'react'
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
}

const ProcessingDialog = memo(({
  open,
  onOpenChange,
  processingJob,
  isConnected,
  usingPolling
}: ProcessingDialogProps) => {
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
            <ProgressBar 
              progress={processingJob.progress}
              stage={processingJob.stage}
              fileName={processingJob.fileName}
              status={processingJob.status}
              isConnected={isConnected}
              usingPolling={usingPolling}
            />
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
