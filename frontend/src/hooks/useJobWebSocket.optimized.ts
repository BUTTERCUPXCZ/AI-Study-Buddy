/**
 * useJobWebSocket Hook (Optimized Version)
 * 
 * React hook for managing WebSocket job tracking with automatic subscription management,
 * polling fallback, and React Query integration.
 * 
 * Key Features:
 * - Automatic WebSocket connection and cleanup
 * - User-level subscription (tracks all jobs for a user)
 * - Job-specific subscription (tracks individual job progress)
 * - Polling fallback when WebSocket disconnects
 * - React Query cache invalidation on job completion
 * - Type-safe event handling
 * - Stable callbacks using refs
 * 
 * Usage:
 * ```typescript
 * const { isConnected, jobProgress, trackJob, stopTracking } = useJobWebSocket({
 *   userId: user?.id,
 *   enabled: true,
 *   onJobCompleted: (noteId) => {
 *     console.log('Job completed, noteId:', noteId);
 *     navigate({ to: `/notes/${noteId}` });
 *   },
 *   onJobFailed: (error) => {
 *     toast.error(`Job failed: ${error}`);
 *   },
 * });
 * 
 * // Start tracking a specific job
 * trackJob(jobId);
 * 
 * // Stop tracking
 * stopTracking();
 * ```
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { webSocketService } from '@/services/WebSocketService.optimized';
import UploadService from '@/services/UploadService';
import { useToast } from '@/hooks/useToast';
import type {
  JobProgressPayload,
  JobCompletedPayload,
  JobFailedPayload,
} from '../types/job-events';
import { JobStage, JobStatus } from '../types/job-events';

/**
 * Hook options
 */
interface UseJobWebSocketOptions {
  userId?: string;
  enabled?: boolean;
  onJobCompleted?: (noteId?: string) => void;
  onJobFailed?: (error?: string) => void;
}

/**
 * Job progress state
 */
interface JobProgress {
  jobId: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  message?: string;
  timestamp: string;
}

/**
 * Hook return value
 */
interface UseJobWebSocketReturn {
  isConnected: boolean;
  jobProgress: JobProgress | null;
  trackJob: (jobId: string) => void;
  stopTracking: () => void;
  usingPolling: boolean;
}

/**
 * useJobWebSocket Hook
 * 
 * @param options - Hook configuration options
 * @returns WebSocket state and control methods
 */
export function useJobWebSocket(
  options: UseJobWebSocketOptions,
): UseJobWebSocketReturn {
  const { userId, enabled = true, onJobCompleted, onJobFailed } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [usingPolling, setUsingPolling] = useState(false);

  // Polling state
  const pollingIntervalRef = useRef<number | null>(null);

  // Callback refs (prevent dependency changes)
  const onJobCompletedRef = useRef(onJobCompleted);
  const onJobFailedRef = useRef(onJobFailed);

  const queryClient = useQueryClient();
  const toast = useToast();

  // Update callback refs when they change
  useEffect(() => {
    onJobCompletedRef.current = onJobCompleted;
    onJobFailedRef.current = onJobFailed;
  }, [onJobCompleted, onJobFailed]);

  /**
   * Start polling fallback for job status
   * Used when WebSocket disconnects during active job processing
   */
  const startPolling = useCallback(
    (jobId: string) => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      console.log('[Hook] Starting polling fallback for job:', jobId);
      setUsingPolling(true);

      pollingIntervalRef.current = window.setInterval(async () => {
        try {
          const status = await UploadService.getJobStatus(jobId);
          console.log('[Hook] Polling status:', status);

          // Update progress
          setJobProgress({
            jobId,
            status: status.status as JobStatus,
            stage: (status.opts?.stage as JobStage) || JobStage.INITIALIZING,
            progress: status.progress || 0,
            message: status.opts?.stage,
            timestamp: new Date().toISOString(),
          });

          // Handle completion
          if (status.status === 'completed') {
            console.log('[Hook] Job completed via polling');
            setUsingPolling(false);
            setCurrentJobId(null);

            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            // Invalidate and refetch notes
            queryClient.invalidateQueries({
              queryKey: ['notes', userId],
              refetchType: 'active',
            });
            queryClient.refetchQueries({
              queryKey: ['notes', userId],
              type: 'active',
            });

            // Extract noteId and trigger callback
            const noteId = status.data?.noteId || status.result?.noteId;
            onJobCompletedRef.current?.(noteId);

            // Clear progress
            setTimeout(() => setJobProgress(null), 500);
          }

          // Handle failure
          if (status.status === 'failed') {
            console.error('[Hook] Job failed via polling');
            setUsingPolling(false);
            setCurrentJobId(null);

            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            onJobFailedRef.current?.((status as unknown as { error?: { message?: string }; failedReason?: string }).error?.message || (status as unknown as { error?: { message?: string }; failedReason?: string }).failedReason || 'Job failed');
            setJobProgress(null);
          }
        } catch (error) {
          console.error('[Hook] Error polling job status:', error);
        }
      }, 3000); // Poll every 3 seconds
    },
    [queryClient, userId],
  );

  /**
   * Stop polling fallback
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('[Hook] Stopping polling');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setUsingPolling(false);
  }, []);

  /**
   * Setup WebSocket connection and subscriptions
   */
  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }

    console.log('[Hook] Setting up WebSocket for user:', userId);

    // Connect to WebSocket (idempotent)
    webSocketService.connect();

    // Subscribe to user's jobs
    webSocketService.subscribe({ userId });

    // Register event handlers
    webSocketService.on({
      onConnect: () => {
        console.log('[Hook] WebSocket connected');
        setIsConnected(true);

        // If we were polling, stop it
        if (usingPolling && currentJobId) {
          console.log('[Hook] WebSocket reconnected, stopping polling');
          stopPolling();
        }
      },

      onDisconnect: (reason) => {
        console.log('[Hook] WebSocket disconnected:', reason);
        setIsConnected(false);

        // Start polling if we have an active job
        if (currentJobId) {
          console.log(
            '[Hook] WebSocket disconnected during active job, starting polling',
          );
          startPolling(currentJobId);
        }
      },

      onJobProgress: (data: JobProgressPayload) => {
        console.log('[Hook] Job progress update:', {
          jobId: data.jobId,
          stage: data.stage,
          progress: data.progress,
        });

        setJobProgress({
          jobId: data.jobId,
          status: data.status,
          stage: data.stage,
          progress: data.progress,
          message: data.message,
          timestamp: data.timestamp,
        });
      },

      onJobCompleted: (data: JobCompletedPayload) => {
        console.log('[Hook] Job completed event received:', {
          jobId: data.jobId,
          noteId: data.result?.noteId,
        });

        // Set completed state briefly for UI feedback
        setJobProgress({
          jobId: data.jobId,
          status: JobStatus.COMPLETED,
          stage: JobStage.COMPLETED,
          progress: 100,
          message: 'Completed!',
          timestamp: data.timestamp,
        });

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({
          queryKey: ['notes', userId],
          refetchType: 'active',
        });
        queryClient.refetchQueries({
          queryKey: ['notes', userId],
          type: 'active',
        });

        // Trigger callback with noteId
        const noteId = data.result?.noteId;
        onJobCompletedRef.current?.(noteId);

        // Clear state after brief delay
        setTimeout(() => {
          setJobProgress(null);
          setCurrentJobId(null);
        }, 500);
      },

      onJobFailed: (data: JobFailedPayload) => {
        console.error('[Hook] Job failed event received:', {
          jobId: data.jobId,
          error: data.error?.message,
        });

        setJobProgress(null);
        setCurrentJobId(null);
        // If Gemini free-tier rate limit triggered, show a user-facing toast
        const rawError = (data.error?.message || '').toString();
        const isGeminiLimit = /gemini/i.test(rawError) && /limit|rate limit|too many requests|429|free tier/i.test(rawError);
        if (isGeminiLimit) {
          // Paraphrased user message: "Gemini free tier limit reached — please try again later."
          try {
            toast.error('Gemini free tier limit reached — please try again later.');
          } catch {
            // Fallback to console and the callback
            console.warn('[Hook] Toast failed, falling back to callback');
          }
        }

        onJobFailedRef.current?.(data.error?.message);
      },
    });

    // Cleanup: unsubscribe but keep connection alive for other components
    return () => {
      console.log('[Hook] Cleaning up, unsubscribing from user:', userId);
      webSocketService.unsubscribe({ userId });
      stopPolling();
    };
  }, [userId, enabled, queryClient, startPolling, stopPolling, currentJobId, toast, usingPolling]);

  /**
   * Track a specific job
   */
  const trackJob = useCallback(
    (jobId: string) => {
      console.log('[Hook] Tracking job:', jobId);
      setCurrentJobId(jobId);

      // Subscribe to job-specific room
      if (isConnected) {
        webSocketService.subscribe({ jobId });
      }

      // If not connected, start polling immediately
      if (!isConnected) {
        console.log(
          '[Hook] WebSocket not connected, starting polling immediately',
        );
        startPolling(jobId);
      }
    },
    [isConnected, startPolling],
  );

  /**
   * Stop tracking current job
   */
  const stopTracking = useCallback(() => {
    console.log('[Hook] Stopping job tracking');

    if (currentJobId && isConnected) {
      webSocketService.unsubscribe({ jobId: currentJobId });
    }

    stopPolling();
    setCurrentJobId(null);
    setJobProgress(null);
  }, [currentJobId, isConnected, stopPolling]);

  return {
    isConnected,
    jobProgress,
    trackJob,
    stopTracking,
    usingPolling,
  };
}
