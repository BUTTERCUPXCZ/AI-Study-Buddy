/**
 * Standardized Job Event DTOs
 *
 * These DTOs ensure consistent event structure across all workers and WebSocket communications.
 * Use these types for all job-related events to maintain type safety and consistency.
 */

export enum JobStage {
  QUEUED = 'queued',
  INITIALIZING = 'initializing',
  DOWNLOADING = 'downloading',
  EXTRACTING_TEXT = 'extracting_text',
  CHECKING_CACHE = 'checking_cache',
  CACHE_HIT = 'cache_hit',
  GENERATING_NOTES = 'generating_notes',
  GENERATING_QUIZ = 'generating_quiz',
  SAVING = 'saving',
  CACHING = 'caching',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum JobStatus {
  QUEUED = 'queued',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  STALLED = 'stalled',
}

/**
 * Base job event payload - all job events extend this
 */
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
    [key: string]: any; // Allow additional metadata
  };
  timestamp: string; // ISO 8601 format
}

/**
 * Job completed event payload
 */
export interface JobCompletedPayload extends JobEventPayload {
  status: JobStatus.COMPLETED;
  stage: JobStage.COMPLETED;
  progress: 100;
  result: {
    noteId?: string;
    quizId?: string;
    title?: string;
    processingTimeMs: number;
    cacheHit: boolean;
    [key: string]: any; // Allow additional result fields
  };
}

/**
 * Job failed event payload
 */
export interface JobFailedPayload extends JobEventPayload {
  status: JobStatus.FAILED;
  stage: JobStage.FAILED;
  error: {
    message: string;
    code: string;
    stack?: string;
    recoverable: boolean;
    retryable?: boolean;
  };
}

/**
 * Job progress event payload (intermediate stages)
 */
export interface JobProgressPayload extends JobEventPayload {
  status: JobStatus.ACTIVE;
  stage: Exclude<JobStage, JobStage.COMPLETED | JobStage.FAILED>;
}

/**
 * Helper to create a job event payload with defaults
 */
export function createJobEventPayload(
  partial: Partial<JobEventPayload> & Pick<JobEventPayload, 'jobId' | 'userId'>,
): JobEventPayload {
  return {
    status: JobStatus.ACTIVE,
    stage: JobStage.INITIALIZING,
    progress: 0,
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

/**
 * Helper to create a completed payload
 */
export function createJobCompletedPayload(
  base: Pick<JobEventPayload, 'jobId' | 'userId'>,
  result: JobCompletedPayload['result'],
): JobCompletedPayload {
  return {
    jobId: base.jobId,
    userId: base.userId,
    status: JobStatus.COMPLETED,
    stage: JobStage.COMPLETED,
    progress: 100,
    timestamp: new Date().toISOString(),
    result,
  };
}

/**
 * Helper to create a failed payload
 */
export function createJobFailedPayload(
  base: Pick<JobEventPayload, 'jobId' | 'userId'>,
  error: JobFailedPayload['error'],
): JobFailedPayload {
  return {
    jobId: base.jobId,
    userId: base.userId,
    status: JobStatus.FAILED,
    stage: JobStage.FAILED,
    progress: 0,
    timestamp: new Date().toISOString(),
    error,
  };
}

/**
 * Stage progress mapping - recommended progress values for each stage
 */
export const STAGE_PROGRESS_MAP: Record<JobStage, number> = {
  [JobStage.QUEUED]: 0,
  [JobStage.INITIALIZING]: 5,
  [JobStage.DOWNLOADING]: 15,
  [JobStage.EXTRACTING_TEXT]: 30,
  [JobStage.CHECKING_CACHE]: 25,
  [JobStage.CACHE_HIT]: 90,
  [JobStage.GENERATING_NOTES]: 60,
  [JobStage.GENERATING_QUIZ]: 75,
  [JobStage.SAVING]: 90,
  [JobStage.CACHING]: 95,
  [JobStage.COMPLETED]: 100,
  [JobStage.FAILED]: 0,
};

/**
 * Stage display names for UI
 */
export const STAGE_DISPLAY_NAMES: Record<JobStage, string> = {
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
