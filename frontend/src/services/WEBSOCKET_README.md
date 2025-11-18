# WebSocket Architecture

This directory contains the WebSocket implementation for real-time job progress tracking.

## Structure

```
services/
  └── WebSocketService.ts    # Core WebSocket connection manager
hooks/
  └── useJobWebSocket.ts     # React hook for job tracking with WebSocket
```

## WebSocketService

A singleton service that manages the WebSocket connection to the backend.

### Features
- **Connection Management**: Handles connecting, disconnecting, and reconnecting to the WebSocket server
- **Event Handling**: Provides callbacks for connection events and job updates
- **Subscription System**: Subscribe to job updates by userId or jobId
- **Automatic Reconnection**: Built-in reconnection logic with exponential backoff

### Usage

```typescript
import { webSocketService } from '@/services/WebSocketService';

// Connect to WebSocket
webSocketService.connect();

// Register event handlers
webSocketService.on({
  onConnect: () => console.log('Connected'),
  onJobProgress: (data) => console.log('Progress:', data),
  onJobCompleted: (data) => console.log('Completed:', data),
});

// Subscribe to job updates
webSocketService.subscribeToJobs({ userId: 'user123' });

// Disconnect when done
webSocketService.disconnect();
```

## useJobWebSocket Hook

A React hook that simplifies WebSocket usage in components, with built-in polling fallback.

### Features
- **Automatic Connection**: Connects to WebSocket when enabled
- **Polling Fallback**: Automatically switches to HTTP polling if WebSocket disconnects
- **Job Tracking**: Track specific jobs and receive real-time progress updates
- **React Query Integration**: Automatically invalidates queries when jobs complete
- **Lifecycle Management**: Handles cleanup on unmount

### Usage

```typescript
import { useJobWebSocket } from '@/hooks/useJobWebSocket';

function MyComponent() {
  const { 
    isConnected, 
    jobProgress, 
    trackJob, 
    stopTracking,
    usingPolling 
  } = useJobWebSocket({
    userId: user?.id,
    enabled: true,
    onJobCompleted: () => {
      console.log('Job completed!');
    },
    onJobFailed: () => {
      console.log('Job failed!');
    },
  });

  const handleUpload = async () => {
    const result = await uploadFile();
    trackJob(result.jobId); // Start tracking the job
  };

  return (
    <div>
      {isConnected ? 'Connected' : 'Disconnected'}
      {usingPolling && <p>Using polling fallback</p>}
      {jobProgress && <p>Progress: {jobProgress.progress}%</p>}
    </div>
  );
}
```

## Event Types

### JobProgressData
```typescript
interface JobProgressData {
  jobId: string;
  status: string;
  progress: number;      // 0-100
  message?: string;      // Progress message
  timestamp: string;
}
```

### JobCompletedData
```typescript
interface JobCompletedData {
  jobId: string;
  status: string;
  result: any;
  timestamp: string;
}
```

### JobErrorData
```typescript
interface JobErrorData {
  jobId: string;
  status: string;
  error: string;
  timestamp: string;
}
```

## Connection Configuration

Default WebSocket configuration:
- **Transports**: WebSocket only (no polling transport)
- **Reconnection**: Enabled
- **Reconnection Delay**: 1000ms
- **Max Delay**: 5000ms
- **Max Attempts**: 5

## Fallback Strategy

When WebSocket connection is lost during job processing:
1. Hook detects disconnection
2. Automatically starts HTTP polling (every 3 seconds)
3. Continues tracking job progress via polling
4. Switches back to WebSocket when connection is restored
5. Polls until job completes or fails

## Best Practices

1. **Enable when needed**: Only enable WebSocket when actively tracking jobs
2. **Clean up**: Always call `stopTracking()` when job tracking is no longer needed
3. **Handle callbacks**: Implement `onJobCompleted` and `onJobFailed` callbacks
4. **Monitor connection**: Display connection status to users when appropriate
5. **Use the hook**: Prefer `useJobWebSocket` over direct service usage in React components

## Integration Example

See `frontend/src/routes/__protected.notes.index.tsx` for a complete implementation example showing:
- Job tracking with WebSocket
- Progress display with ProcessingModal
- Automatic fallback to polling
- Success/error handling
