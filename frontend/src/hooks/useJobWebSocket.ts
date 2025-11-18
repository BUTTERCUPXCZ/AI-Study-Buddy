    import { useEffect, useState, useCallback, useRef } from 'react';
    import { useQueryClient } from '@tanstack/react-query';
    import { webSocketService } from '@/services/WebSocketService';
    import UploadService from '@/services/UploadService';

    interface UseJobWebSocketOptions {
    userId?: string;
    enabled?: boolean;
    onJobCompleted?: () => void;
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

            // Invalidate queries to refresh data
            queryClient.invalidateQueries({ 
                queryKey: ['notes', userId],
                refetchType: 'active'
            });
            
            // Also explicitly refetch
            queryClient.refetchQueries({ 
                queryKey: ['notes', userId],
                type: 'active'
            });
            
            console.log('[useJobWebSocket] Notes query invalidated and refetch triggered (polling)');
            
            onJobCompletedRef.current?.();
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
        if (!enabled || !userId) {
        webSocketService.disconnect();
        setIsConnected(false);
        return;
        }

        // Connect and setup handlers
        webSocketService.connect();
        
        webSocketService.on({
        onConnect: () => {
            setIsConnected(true);
            setConnectionError(null);
            
            // Subscribe to user's job updates
            webSocketService.subscribeToJobs({ userId });
            
            // If we were polling, stop it since WebSocket is back
            stopPolling();
        },
        
        onDisconnect: () => {
            setIsConnected(false);
            
            // Start polling if we have an active job - use functional state update to get latest
            setCurrentJobId(currentId => {
            if (currentId) {
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
            console.log('[useJobWebSocket] Job completed, invalidating notes for userId:', userId);
            
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
            
            // Also explicitly refetch to ensure the data is fresh
            queryClient.refetchQueries({ 
                queryKey: ['notes', userId],
                type: 'active'
            });
            
            console.log('[useJobWebSocket] Notes query invalidated and refetch triggered');
            
            // Trigger the callback immediately
            onJobCompletedRef.current?.();
            
            // Clear state quickly to allow modal to close
            setTimeout(() => {
            setJobProgress(null);
            setCurrentJobId(null);
            }, 100);
        },
        
        onJobError: () => {
            setJobProgress(null);
            setCurrentJobId(null);
            onJobFailedRef.current?.();
        },
        });

        return () => {
        if (userId) {
            webSocketService.unsubscribeFromJobs({ userId });
        }
        webSocketService.disconnect();
        stopPolling();
        };
    }, [userId, enabled, queryClient, startPolling, stopPolling]);

    // Monitor job tracking
    const trackJob = useCallback((jobId: string) => {
        setCurrentJobId(jobId);
        
        // If WebSocket is not connected, start polling immediately
        if (!isConnected) {
        startPolling(jobId);
        }
    }, [isConnected, startPolling]);

    // Stop tracking job
    const stopTracking = useCallback(() => {
        setCurrentJobId(null);
        setJobProgress(null);
        stopPolling();
    }, [stopPolling]);

    return {
        isConnected,
        jobProgress: jobProgress || (pollingProgress ? {
        jobId: currentJobId || '',
        status: 'active',
        progress: pollingProgress.progress,
        message: pollingProgress.message,
        timestamp: new Date().toISOString(),
        } : null),
        connectionError,
        trackJob,
        stopTracking,
        usingPolling: !isConnected && currentJobId !== null,
    };
    };
