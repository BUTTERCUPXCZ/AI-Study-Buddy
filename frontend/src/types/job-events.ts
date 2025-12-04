/**
 * Job Event Type Definitions (Frontend)
 * 
 * Mirror of backend DTOs for type safety across the full stack.
 * Keep these in sync with backend/src/jobs/dto/job-event.dto.ts
 */

export const JobStage = {
  QUEUED: 'queued',
  INITIALIZING: 'initializing',
  DOWNLOADING: 'downloading',
  EXTRACTING_TEXT: 'extracting_text',
  CHECKING_CACHE: 'checking_cache',
  CACHE_HIT: 'cache_hit',
  GENERATING_NOTES: 'generating_notes',
  GENERATING_QUIZ: 'generating_quiz',
  SAVING: 'saving',
  CACHING: 'caching',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type JobStage = typeof JobStage[keyof typeof JobStage];

export const JobStatus = {
  QUEUED: 'queued',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  STALLED: 'stalled',
} as const;

export type JobStatus = typeof JobStatus[keyof typeof JobStatus];

export interface JobEventPayload {
  jobId: string;
  userId: string;
  status: JobStatus;
  stage: JobStage;
  progress: number; // 0-100
  message?: string;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    fileId?: string;
    noteId?: string;
    quizId?: string;
    cacheHit?: boolean;
    processingTimeMs?: number;
    estimatedTimeRemainingMs?: number;
    [key: string]: any;
  };
  timestamp: string;
}

export interface JobCompletedPayload extends JobEventPayload {
  status: 'completed';
  stage: 'completed';
  progress: 100;
  result: {
    noteId?: string;
    quizId?: string;
    title?: string;
    processingTimeMs: number;
    cacheHit: boolean;
    [key: string]: any;
  };
}

export interface JobFailedPayload extends JobEventPayload {
  status: 'failed';
  stage: 'failed';
  error: {
    message: string;
    code: string;
    stack?: string;
    recoverable: boolean;
    retryable?: boolean;
  };
}

export interface JobProgressPayload extends JobEventPayload {
  status: 'active';
  stage: Exclude<JobStage, 'completed' | 'failed'>;
}

/**
 * Stage display names for UI
 */
export const STAGE_DISPLAY_NAMES: Record<string, string> = {
  [JobStage.QUEUED]: 'In Queue',
  [JobStage.INITIALIZING]: 'Starting',
  [JobStage.DOWNLOADING]: 'Downloading PDF',
  [JobStage.EXTRACTING_TEXT]: 'Extracting Text',
  [JobStage.CHECKING_CACHE]: 'Checking Cache',
  [JobStage.CACHE_HIT]: 'Using Cached Notes',
  [JobStage.GENERATING_NOTES]: 'Generating Notes',
  [JobStage.GENERATING_QUIZ]: 'Generating Quiz',
  [JobStage.SAVING]: 'Saving',
  [JobStage.CACHING]: 'Caching for Future',
  [JobStage.COMPLETED]: 'Completed',
  [JobStage.FAILED]: 'Failed',
};

/**
 * Get user-friendly message for a job stage
 */
export function getStageDisplayName(stage: JobStage): string {
  return STAGE_DISPLAY_NAMES[stage] || stage;
}

/**
 * Check if a stage represents a terminal state (completed or failed)
 */
export function isTerminalStage(stage: JobStage): boolean {
  return stage === 'completed' || stage === 'failed';
}

/**
 * Check if a stage represents an active/processing state
 */
export function isActiveStage(stage: JobStage): boolean {
  return (
    stage !== 'queued' &&
    stage !== 'completed' &&
    stage !== 'failed'
  );
}
