import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ProcessingModalProps {
  open: boolean;
  progress: number;
  stage?: string;
  isConnected?: boolean;
  usingPolling?: boolean;
  onComplete?: () => void; // Callback when job completes
}

const getStageMessage = (stage?: string): string => {
  if (!stage) return 'Processing your document...';
  
  switch (stage.toLowerCase()) {
    case 'processing':
    case 'uploading':
      return 'Processing your PDF...';
    case 'uploading_to_gemini':
      return 'Uploading PDF to Gemini AI...';
    case 'generating_notes':
    case 'generating notes':
      return 'Gemini is analyzing your PDF and generating study notes...';
    case 'saving_notes':
    case 'saving notes':
      return 'Saving your generated notes...';
    case 'completed':
    case 'complete':
      return 'Completed! Finalizing...';
    default:
      return stage;
  }
};

export function ProcessingModal({ 
  open, 
  progress, 
  stage, 
  isConnected = true, 
  usingPolling = false,
  onComplete 
}: ProcessingModalProps) {
  // Ensure progress is between 0 and 100
  const clampedProgress = Math.min(Math.max(progress || 0, 0), 100);
  
  // Listen for job completion (progress reaches 100% OR stage is 'completed')
  useEffect(() => {
    const isCompleted = clampedProgress === 100 || 
                       stage?.toLowerCase() === 'completed' || 
                       stage?.toLowerCase() === 'complete';
    
    if (isCompleted && open) {
      console.log('[ProcessingModal] Job completed detected! Progress:', clampedProgress, 'Stage:', stage);
      
      // Brief delay to show 100% completion, then trigger callback
      const timer = setTimeout(() => {
        console.log('[ProcessingModal] Triggering onComplete callback');
        onComplete?.();
      }, 500); // Show completion state for 500ms before closing
      
      return () => clearTimeout(timer);
    }
  }, [clampedProgress, stage, open, onComplete]);
  
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md"  onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Creating Your Study Notes
            {usingPolling && (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-amber-500">
                <WifiOff className="h-3 w-3" />
                Polling mode
              </span>
            )}
            {!usingPolling && isConnected && (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-green-500">
                <Wifi className="h-3 w-3" />
                Live
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="space-y-4 pt-4">
            <p className="text-sm">
              Please wait while Gemini AI reads your PDF and generates comprehensive study notes.
              This process is faster than traditional text extraction!
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{getStageMessage(stage)}</span>
                <span>{clampedProgress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
                  style={{ width: `${clampedProgress}%` }}
                />
              </div>
            </div>
            {usingPolling && (
              <p className="text-xs text-amber-600 dark:text-amber-500 italic">
                ⚠️ Real-time connection lost. Using fallback polling (updates every 3 seconds)
              </p>
            )}
            <p className="text-xs text-muted-foreground italic">
              💡 Tip: Gemini AI directly reads your PDF for the best understanding!
            </p>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
