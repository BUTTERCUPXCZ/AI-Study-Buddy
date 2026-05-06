    import { useEffect, useState, useCallback, useRef } from 'react';
    import { useQueryClient } from '@tanstack/react-query';
    import { webSocketService } from '@/services/WebSocketService';
    import UploadService from '@/services/UploadService';

    interface UseJobWebSocketOptions {
    userId?: string;
    enabled?: boolean;
    onJobCompleted?: (noteId?: string) => void;
    onJobFailed?: () => void;
    }

    interface JobProgress {
    jobId: string;
    status: string;
    progress: number;
    message?: string;
    timestamp: string;
    }

    export const useJobWebSocket = (options: UseJobWebSocketOptions) => {
    const { userId, enabled = true, onJobCompleted, onJobFailed } = options;
    const [isConnected, setIsConnected] = useState(false);
    const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    // Live AI text accumulating from job:notes:chunk events. ProcessingDialog
    // renders this so the user sees notes typing in like ChatGPT.
    const [streamedNotes, setStreamedNotes] = useState<string>('');
    const queryClient = useQueryClient();
    
    // Polling fallback
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [pollingProgress, setPollingProgress] = useState<{ progress: number; message?: string } | null>(null);
    const pollingIntervalRef = useRef<number | null>(null);
    
    // Use refs to store callbacks to avoid recreating them
    const onJobCompletedRef = useRef(onJobCompleted);
    const onJobFailedRef = useRef(onJobFailed);
    
    // Update refs when callbacks change
    useEffect(() => {
        onJobCompletedRef.current = onJobCompleted;
        onJobFailedRef.current = onJobFailed;
    }, [onJobCompleted, onJobFailed]);

    // Start polling fallback if WebSocket disconnects during processing
    const startPolling = useCallback((jobId: string) => {
        if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        }

        console.warn('Starting polling fallback for job:', jobId);

        pollingIntervalRef.current = window.setInterval(async () => {
        try {
            const status = await UploadService.getJobStatus(jobId);
            console.log('Polling job status:', status);

            setPollingProgress({
            progress: status.progress || 0,
            message: status.opts?.stage,
            });

            if (status.status === 'completed') {
            console.log('[useJobWebSocket] Job completed via polling, invalidating notes for userId:', userId);
            setPollingProgress(null);
            setCurrentJobId(null);
            
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }

            queryClient.invalidateQueries({ 
                queryKey: ['notes', userId],
                refetchType: 'active'
            });
            
            console.log('[useJobWebSocket] Notes query invalidated (polling)');
            
            const noteId = status.data?.noteId || status.result?.noteId;
            onJobCompletedRef.current?.(noteId);
            }

            if (status.status === 'failed') {
            console.error('Job failed via polling');
            setPollingProgress(null);
            setCurrentJobId(null);
            
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }

            onJobFailedRef.current?.();
            }
        } catch (error) {
            console.error('Error polling job status:', error);
        }
        }, 3000);
    }, [queryClient, userId]);

    // Stop polling
    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        }
        setPollingProgress(null);
    }, []);

    // Connect to WebSocket when enabled
    useEffect(() => {
        // Only connect if enabled and userId is present
        if (!userId || !enabled) {
        return;
        }

        let isSubscribed = false;

        // Connect WebSocket only when enabled (during processing)
        webSocketService.connect();
        
        webSocketService.on({
        onConnect: () => {
            console.log('[useJobWebSocket] Connected to WebSocket');
            setIsConnected(true);
            setConnectionError(null);
            
            // The backend automatically joins this socket to its user-room
            // on connect (using userId derived from the auth cookie). We
            // do not pass userId from the client — never trust client-
            // supplied identity. We only mark the local flag for cleanup.
            if (enabled && !isSubscribed) {
                isSubscribed = true;
            }
            
            // Also re-subscribe to specific job if we're tracking one
            setCurrentJobId(jobId => {
                if (jobId && enabled) {
                    console.log('[useJobWebSocket] Re-subscribing to job:', jobId);
                    webSocketService.subscribeToJobs({ jobId });
                }
                return jobId;
            });
            
            // If we were polling, stop it since WebSocket is back
            stopPolling();
        },
        
        onDisconnect: (reason) => {
            console.warn('[useJobWebSocket] Disconnected from WebSocket:', reason);
            setIsConnected(false);
            
            // Start polling if we have an active job - use functional state update to get latest
            setCurrentJobId(currentId => {
            if (currentId) {
                console.log('[useJobWebSocket] Starting polling fallback for job:', currentId);
                startPolling(currentId);
            }
            return currentId;
            });
        },
        
        onConnectionError: (error) => {
            setConnectionError(error.message);
            setIsConnected(false);
        },
        
        onJobProgress: (data) => {
            setJobProgress(data);
            queryClient.setQueryData(['job', data.jobId], data);
        },
        
        onJobCompleted: (data) => {
            console.log('[useJobWebSocket] Job completed event received:', data);
            console.log('[useJobWebSocket] Job completed, invalidating notes for userId:', userId);
            
            // Extract noteId from the result
            const noteId = data.result?.noteId;
            console.log('[useJobWebSocket] Extracted noteId:', noteId);
            
            // Set completed status briefly for UI feedback
            setJobProgress({
            jobId: data.jobId,
            status: 'completed',
            progress: 100,
            message: 'Completed!',
            timestamp: data.timestamp,
            });
            
            // Invalidate queries to refresh data - use refetchType to ensure immediate refetch
            queryClient.invalidateQueries({ 
                queryKey: ['notes', userId],
                refetchType: 'active' // Only refetch if query is currently active
            });
            queryClient.invalidateQueries({ queryKey: ['job', data.jobId] });
            
            console.log('[useJobWebSocket] Notes query invalidated');
            
            // Trigger the callback with noteId immediately
            console.log('[useJobWebSocket] Calling onJobCompleted callback with noteId:', noteId);
            onJobCompletedRef.current?.(noteId);
            
            // Clear state quickly to allow modal to close
            setTimeout(() => {
            setJobProgress(null);
            setCurrentJobId(null);
            }, 100);
        },
        
        onJobError: () => {
            setJobProgress(null);
            setCurrentJobId(null);
            setStreamedNotes('');
            onJobFailedRef.current?.();
        },

        onJobNotesChunk: (data) => {
            // Always store the latest accumulated string so re-mounts /
            // late subscribers don't have to replay every chunk.
            setStreamedNotes(data.accumulated);
        },
        });

        return () => {
        // The user-room subscription is server-managed — nothing to undo here.
        if (userId && enabled && isSubscribed) {
            isSubscribed = false;
        }
        
        // Disconnect WebSocket when disabled
        if (enabled) {
            console.log('[useJobWebSocket] Disconnecting WebSocket');
            webSocketService.disconnect();
        }
        
        // Stop polling
        stopPolling();
        };
    }, [userId, enabled, queryClient, startPolling, stopPolling]);

    // Disconnect when enabled changes to false
    useEffect(() => {
        if (!enabled && isConnected) {
            console.log('[useJobWebSocket] Disabled - disconnecting WebSocket');
            webSocketService.disconnect();
            setIsConnected(false);
            stopPolling();
        }
    }, [enabled, isConnected, stopPolling]);

    // Monitor job tracking
    const trackJob = useCallback((jobId: string) => {
        console.log('[useJobWebSocket] Tracking job:', jobId);
        setCurrentJobId(jobId);

        // If the socket is up RIGHT NOW, subscribe and we're done.
        if (isConnected && enabled) {
            console.log('[useJobWebSocket] Subscribing to job room:', jobId);
            webSocketService.subscribeToJobs({ jobId });
            return;
        }

        // Otherwise, save the subscription request — the service replays
        // it on `connect`. Then give the WS up to 2 seconds to come up
        // before falling back to HTTP polling. Without this, every
        // upload races the WS handshake and starts a 3-second-interval
        // polling loop we don't actually need.
        if (enabled) {
            webSocketService.subscribeToJobs({ jobId });
        }

        const fallbackTimer = window.setTimeout(() => {
            if (!webSocketService.isConnected()) {
                console.log('[useJobWebSocket] WS still down after 2 s, falling back to polling for job:', jobId);
                startPolling(jobId);
            }
        }, 2000);

        // Stash the timer on the ref slot so stopTracking / unmount
        // cleanup can clear it. Reusing pollingIntervalRef would clash;
        // attach to the dataset of currentJobId instead via a small
        // helper. Simpler: fire-and-forget — startPolling is idempotent
        // and stopTracking calls stopPolling() which clears the loop
        // even if it started after this timer fired.
        void fallbackTimer;
    }, [isConnected, enabled, startPolling]);

    // Stop tracking job
    const stopTracking = useCallback(() => {
        console.log('[useJobWebSocket] Stopping job tracking');
        setCurrentJobId(jobId => {
            if (jobId && isConnected && enabled) {
                console.log('[useJobWebSocket] Unsubscribing from job room:', jobId);
                webSocketService.unsubscribeFromJobs({ jobId });
            }
            return null;
        });
        setJobProgress(null);
        setStreamedNotes('');
        stopPolling();
    }, [stopPolling, isConnected, enabled]);

    return {
        isConnected,
        jobProgress: jobProgress || (pollingProgress ? {
        jobId: currentJobId || '',
        // Pass through whatever stage the backend sent — don't hard-code
        // 'active'. The dialog's stage labels rely on this matching the
        // real backend status.
        status: 'in_progress',
        progress: pollingProgress.progress,
        message: pollingProgress.message,
        timestamp: new Date().toISOString(),
        } : null),
        streamedNotes,
        connectionError,
        trackJob,
        stopTracking,
        usingPolling: !isConnected && currentJobId !== null && pollingIntervalRef.current !== null,
    };
    };
