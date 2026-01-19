import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, FileText, WifiOff, Zap, Upload, Brain, FileCheck, BookOpen } from 'lucide-react';
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

const getStageInfo = (stage: string, progress: number) => {
  const stageLower = stage.toLowerCase();
  
  // Stage 1: Validation (0-10%)
  if (stageLower.includes('validat') || stageLower.includes('initial') || progress <= 10) {
    return {
      icon: Upload,
      label: 'Validating Document',
      description: 'Checking your PDF for processing...',
      color: 'text-blue-500',
    };
  }
  
  // Stage 2: AI Processing / Generating Notes (30-70%)
  if (stageLower.includes('generat') || stageLower.includes('ai') || stageLower.includes('processing pdf') || (progress > 10 && progress <= 70)) {
    return {
      icon: Brain,
      label: 'AI Processing',
      description: progress < 30 ? 'Preparing for AI analysis...' : 'Generating intelligent study notes...',
      color: 'text-purple-500',
    };
  }
  
  // Stage 3: Notes Generated & Saved (70-84%)
  if (stageLower.includes('notes generated') || stageLower.includes('saved') || (progress > 70 && progress < 85)) {
    return {
      icon: FileCheck,
      label: 'Notes Ready',
      description: 'Study notes saved successfully!',
      color: 'text-emerald-500',
    };
  }
  
  // Stage 4: Quiz Generation (85-99%)
  if (stageLower.includes('quiz') || (progress >= 85 && progress < 100)) {
    return {
      icon: BookOpen,
      label: 'Generating Quiz',
      description: 'Creating practice questions for you...',
      color: 'text-amber-500',
    };
  }
  
  // Stage 5: Completed (100%)
  if (stageLower.includes('complet') || progress === 100) {
    return {
      icon: CheckCircle2,
      label: 'Complete',
      description: 'All done! Your study materials are ready.',
      color: 'text-green-500',
    };
  }
  
  // Cache checking
  if (stageLower.includes('cache') || stageLower.includes('checking')) {
    return {
      icon: Zap,
      label: 'Checking Cache',
      description: 'Looking for existing results...',
      color: 'text-yellow-500',
    };
  }
  
  // Default
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
  const stageInfo = getStageInfo(stage, progress);
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
            {/* Stage 1: Validation (0-10%) */}
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                displayProgress >= 10 
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50 scale-110' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <Upload className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${displayProgress >= 10 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                Validate
              </span>
            </div>
            
            {/* Stage 2: AI Processing (30-70%) */}
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                displayProgress >= 30 
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50 scale-110' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <Brain className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${displayProgress >= 30 ? 'text-purple-600' : 'text-muted-foreground'}`}>
                AI Process
              </span>
            </div>
            
            {/* Stage 3: Notes Saved (70%) */}
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                displayProgress >= 70 
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/50 scale-110' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <FileCheck className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${displayProgress >= 70 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                Notes
              </span>
            </div>
            
            {/* Stage 4: Quiz Generation (85%) */}
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                displayProgress >= 85 
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/50 scale-110' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <BookOpen className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${displayProgress >= 85 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                Quiz
              </span>
            </div>
            
            {/* Stage 5: Complete (100%) */}
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                displayProgress === 100 
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/50 scale-110' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${displayProgress === 100 ? 'text-green-600' : 'text-muted-foreground'}`}>
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
