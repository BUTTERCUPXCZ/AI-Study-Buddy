# WebSocket Connection Loop Fix

## Problem Summary

The WebSocket connection was stuck in an infinite reconnection loop:
- Clients would connect and immediately disconnect
- This happened every ~500ms continuously
- Job progress updates were never received
- Processing would appear stuck even though backend was working

## Root Causes Identified

### 1. **React StrictMode + useEffect Dependencies** ❌
- React StrictMode (enabled in development) causes effects to run twice
- The `useJobWebSocket` hook had unstable dependencies in the useEffect array
- Dependencies included: `currentJobId`, `jobProgress`, `onJobCompleted`, `onJobFailed`
- Every state change triggered reconnection

### 2. **Dynamic `enabled` Prop** ❌
- WebSocket was enabled/disabled based on `isProcessingState`
- When processing started/stopped, this caused reconnection
- WebSocket should stay connected throughout the user session

### 3. **Missing Connection Guards** ❌
- No protection against duplicate connections
- No subscription tracking (could subscribe multiple times)
- Event handlers were recreated on every render

### 4. **Wrong Backend Event Emission** ❌
- Backend was emitting to `payload.userId` instead of `user:${userId}` room
- Clients subscribed to `user:${userId}` but events sent to wrong room
- Job updates never reached the frontend

## Fixes Applied

### Frontend Fixes

#### 1. Fixed useJobWebSocket Hook Dependencies
**File**: `frontend/src/hooks/useJobWebSocket.ts`

- ✅ Added refs for callback functions to prevent recreation
- ✅ Removed unstable dependencies from useEffect array
- ✅ Used functional state updates to access latest values
- ✅ Changed callbacks to use refs (`onJobCompletedRef.current`)

```typescript
// Before
useEffect(() => {
  // ... setup
}, [userId, enabled, queryClient, onJobCompleted, onJobFailed, currentJobId, jobProgress, startPolling, stopPolling]);

// After
useEffect(() => {
  // ... setup
}, [userId, enabled, queryClient, startPolling, stopPolling]);
```

#### 2. Keep WebSocket Connected Always
**File**: `frontend/src/routes/__protected.notes.index.tsx`

- ✅ Changed `enabled: isProcessingState` to `enabled: true`
- ✅ WebSocket now stays connected throughout the session
- ✅ No more reconnection when jobs start/stop

```typescript
// Before
const { ... } = useJobWebSocket({
  userId: user?.id,
  enabled: isProcessingState, // ❌ Causes reconnection
  // ...
});

// After
const { ... } = useJobWebSocket({
  userId: user?.id,
  enabled: true, // ✅ Always connected
  // ...
});
```

#### 3. Improved WebSocketService
**File**: `frontend/src/services/WebSocketService.ts`

- ✅ Added `isConnecting` flag to prevent duplicate connections
- ✅ Added subscription tracking with Set to prevent duplicate subscriptions
- ✅ Improved disconnect to clear all state properly
- ✅ Added better logging for debugging

```typescript
class WebSocketService {
  private isConnecting: boolean = false;
  private subscriptions: Set<string> = new Set();

  connect() {
    if (this.socket?.connected || this.isConnecting) {
      return this.socket!;
    }
    this.isConnecting = true;
    // ...
  }

  subscribeToJobs(params) {
    const subKey = JSON.stringify(params);
    if (this.subscriptions.has(subKey)) {
      return; // Already subscribed
    }
    // ...
  }
}
```

### Backend Fixes

#### 4. Fixed Job Update Emission
**File**: `backend/src/websocket/websocket.gateway.ts`

- ✅ Emit to correct room: `user:${userId}` instead of just `userId`
- ✅ Emit to both user room and job-specific room
- ✅ Use correct event name: `job:progress` instead of `job_update`
- ✅ Added proper logging

```typescript
// Before
async emitJobUpdate(jobId: string, status: string, payload: any) {
  this.server.to(payload.userId).emit('job_update', { ... }); // ❌
}

// After
async emitJobUpdate(jobId: string, status: string, payload: any) {
  const userRoom = `user:${payload.userId}`;
  const jobRoom = `job:${payload.jobId}`;
  
  const updateData = { ... };
  
  this.server.to(userRoom).emit('job:progress', updateData); // ✅
  this.server.to(jobRoom).emit('job:progress', updateData); // ✅
}
```

## Testing Steps

1. **Clear browser cache and reload**
2. **Upload a PDF file**
3. **Check browser console** - Should see:
   - Single "WebSocket connected" message
   - "Subscribed to jobs: { userId: ... }"
   - No rapid connect/disconnect cycles
4. **Check backend logs** - Should see:
   - Single client connection
   - Job progress emissions to correct rooms
   - No reconnection spam
5. **Verify progress modal** shows real-time updates
6. **Verify completion** triggers success message

## Expected Behavior Now

### Frontend
```
✅ WebSocket connected: abc123
✅ Subscribed to jobs: { userId: 'cmhvus1ep000079bgkcp65onm' }
✅ Job progress: { jobId: '...', progress: 20, message: 'Processing PDF...' }
✅ Job progress: { jobId: '...', progress: 40, message: 'Analyzing PDF with AI' }
✅ Job progress: { jobId: '...', progress: 90, message: 'Notes generated' }
✅ Job completed: { jobId: '...', status: 'completed' }
✅ Unsubscribed from jobs
✅ WebSocket disconnected (on unmount)
```

### Backend
```
✅ Client connected: abc123
✅ Client subscribed to user:cmhvus1ep000079bgkcp65onm
✅ Job update emitted for job pdf-notes-... to user:cmhvus1ep000079bgkcp65onm
✅ Job progress: 20%, 40%, 90%, 100%
✅ Client unsubscribed (on unmount)
✅ Client disconnected (on unmount)
```

## Key Takeaways

1. **Be careful with useEffect dependencies** - Unstable dependencies cause infinite loops
2. **Use refs for callbacks** - Prevents effect re-runs on callback changes
3. **Keep connections stable** - Don't reconnect unnecessarily
4. **Match room names** - Ensure emit/subscribe use same room format
5. **Track subscriptions** - Prevent duplicate subscriptions in singleton services
6. **Test in StrictMode** - Catches effect-related bugs early

## Files Modified

- ✅ `frontend/src/hooks/useJobWebSocket.ts`
- ✅ `frontend/src/services/WebSocketService.ts`
- ✅ `frontend/src/routes/__protected.notes.index.tsx`
- ✅ `backend/src/websocket/websocket.gateway.ts`

## Status

🎉 **FIXED** - WebSocket connections now stable, job progress updates working correctly!
