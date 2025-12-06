import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, FileText, Sparkles, Database, WifiOff, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface ProgressBarProps {
  progress: number;
  stage: string;
  fileName: string;
  status: 'processing' | 'completed' | 'failed';
  isConnected?: boolean;
  usingPolling?: boolean;
}

const getStageInfo = (stage: string) => {
  const stageLower = stage.toLowerCase();
  
  if (stageLower.includes('initial') || stageLower.includes('uploading')) {
    return {
      icon: FileText,
      label: 'Uploading PDF',
      description: 'Preparing your document...',
      color: 'text-blue-500',
    };
  }
  
  if (stageLower.includes('download')) {
    return {
      icon: FileText,
      label: 'Processing PDF',
      description: 'Reading your document...',
      color: 'text-blue-500',
    };
  }
  
  if (stageLower.includes('cache') || stageLower.includes('extract') || stageLower.includes('text')) {
    return {
      icon: FileText,
      label: 'Analyzing Content',
      description: 'Extracting text and structure...',
      color: 'text-purple-500',
    };
  }
  
  if (stageLower.includes('generat') || stageLower.includes('ai') || stageLower.includes('notes')) {
    return {
      icon: Sparkles,
      label: 'AI Generating Notes',
      description: 'Creating comprehensive study notes...',
      color: 'text-amber-500',
    };
  }
  
  if (stageLower.includes('sav')) {
    return {
      icon: Database,
      label: 'Saving Notes',
      description: 'Finalizing your study materials...',
      color: 'text-green-500',
    };
  }
  
  if (stageLower.includes('complet')) {
    return {
      icon: CheckCircle2,
      label: 'Completed',
      description: 'Your notes are ready!',
      color: 'text-green-500',
    };
  }
  
  return {
    icon: LoadingSpinner,
    label: 'Processing',
    description: stage || 'Working on your document...',
    color: 'text-blue-500',
  };
};

export function ProgressBar({ 
  progress, 
  stage, 
  fileName, 
  status,
  isConnected = true,
  usingPolling = false 
}: ProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(progress);
  const stageInfo = getStageInfo(stage);
  const Icon = stageInfo.icon;
  
  // Smooth progress animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayProgress(progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);
  
  const getProgressColor = () => {
    if (status === 'failed') return 'bg-gradient-to-r from-red-500 to-red-600';
    if (status === 'completed') return 'bg-gradient-to-r from-green-500 to-emerald-600';
    if (displayProgress < 30) return 'bg-gradient-to-r from-blue-500 to-blue-600';
    if (displayProgress < 70) return 'bg-gradient-to-r from-purple-500 to-purple-600';
    return 'bg-gradient-to-r from-amber-500 to-amber-600';
  };
  
  const getStatusIcon = () => {
    if (status === 'completed') {
      return <CheckCircle2 className="w-16 h-16 text-green-500 animate-in zoom-in duration-500" />;
    }
    
    if (status === 'failed') {
      return <XCircle className="w-16 h-16 text-red-500 animate-in zoom-in duration-500" />;
    }
    
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
        <Icon className={`w-16 h-16 ${stageInfo.color} relative z-10 ${Icon === Loader2 ? 'animate-spin' : ''}`} />
      </div>
    );
  };
  
  const getConnectionBadge = () => {
    if (usingPolling) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <WifiOff className="w-3 h-3 mr-1" />
          Polling Mode
        </Badge>
      );
    }
    
    if (isConnected) {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
          <Zap className="w-3 h-3 mr-1" />
          Real-time
        </Badge>
      );
    }
    
    return null;
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 p-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      {/* Main Icon & Status */}
      <div className="flex flex-col items-center text-center space-y-4">
        {getStatusIcon()}
        
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-foreground">
            {status === 'completed' ? 'Notes Generated!' : 
             status === 'failed' ? 'Generation Failed' : 
             stageInfo.label}
          </h3>
          <p className="text-muted-foreground text-lg">
            {status === 'completed' ? 'Your study notes are ready to view' :
             status === 'failed' ? 'Something went wrong. Please try again.' :
             stageInfo.description}
          </p>
        </div>
        
        {/* File Name Badge */}
        <Badge variant="secondary" className="text-sm px-4 py-1.5 font-medium">
          <FileText className="w-4 h-4 mr-2" />
          {fileName}
        </Badge>
        
        {/* Connection Status */}
        {status === 'processing' && getConnectionBadge()}
      </div>

      {/* Progress Section */}
      {status === 'processing' && (
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Progress</span>
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {Math.round(displayProgress)}%
              </span>
            </div>
            <div className="relative h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${getProgressColor()} transition-all duration-500 ease-out rounded-full relative`}
                style={{ width: `${displayProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>
          
          {/* Stage Timeline */}
          <div className="grid grid-cols-5 gap-2 pt-4">
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                displayProgress >= 10 
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/50' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <FileText className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${displayProgress >= 10 ? 'text-primary' : 'text-muted-foreground'}`}>
                Upload
              </span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                displayProgress >= 30 
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/50' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <FileText className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${displayProgress >= 30 ? 'text-primary' : 'text-muted-foreground'}`}>
                Extract
              </span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                displayProgress >= 50 
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/50' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <Sparkles className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${displayProgress >= 50 ? 'text-primary' : 'text-muted-foreground'}`}>
                Generate
              </span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                displayProgress >= 90 
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/50' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <Database className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${displayProgress >= 90 ? 'text-primary' : 'text-muted-foreground'}`}>
                Save
              </span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                displayProgress === 100 
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/50' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${displayProgress === 100 ? 'text-primary' : 'text-muted-foreground'}`}>
                Done
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Success/Failure Messages */}
      {status === 'completed' && (
        <div className="text-center text-sm text-muted-foreground animate-in fade-in duration-500">
          Redirecting you to your notes...
        </div>
      )}
      
      {status === 'failed' && (
        <div className="text-center text-sm text-red-600 animate-in fade-in duration-500">
          Please check your file and try again.
        </div>
      )}
    </div>
  );
}
