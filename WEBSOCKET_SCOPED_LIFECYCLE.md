# WebSocket Scoped Lifecycle Implementation

## 🎯 Overview

This document explains the implementation of a **scoped WebSocket lifecycle** that only activates during PDF processing and automatically cleans up after completion. This solves the issue where WebSocket connections remained subscribed after job completion, causing problems for subsequent uploads.

## 🔧 Changes Made

### 1. **Dynamic WebSocket Enable State** (`__protected.notes.index.tsx`)

Added a new state variable to control when WebSocket should be enabled:

```typescript
// WebSocket should only be enabled during active processing
const [wsEnabled, setWsEnabled] = useState(false)
```

**Before**: WebSocket was always enabled (`enabled: true`)
**After**: WebSocket is only enabled during active processing (`enabled: wsEnabled`)

### 2. **Updated Callback Signatures**

Modified `onJobCompleted` and `onJobFailed` callbacks to receive the `stopTracking` function:

```typescript
const onJobCompleted = useCallback((noteId?: string, stopTrackingFn?: () => void) => {
  // ... handle completion
  setWsEnabled(false);
  if (stopTrackingFn) {
    stopTrackingFn(); // Unsubscribe from WebSocket
  }
}, [queryClient, navigate, user?.id]);

const onJobFailed = useCallback((stopTrackingFn?: () => void) => {
  // ... handle failure
  setWsEnabled(false);
  if (stopTrackingFn) {
    stopTrackingFn(); // Unsubscribe from WebSocket
  }
}, []);
```

### 3. **WebSocket Hook Configuration**

Updated `useJobWebSocket` to use dynamic enabled state and pass `stopTracking` to callbacks:

```typescript
const { 
  jobProgress, 
  trackJob, 
  stopTracking,
  isConnected,
  usingPolling 
} = useJobWebSocket({
  userId: user?.id,
  enabled: wsEnabled, // Dynamic enable state
  onJobCompleted: (noteId?: string) => onJobCompleted(noteId, stopTracking),
  onJobFailed: () => onJobFailed(stopTracking),
});
```

### 4. **Enable WebSocket on Upload Start**

When user starts uploading a PDF, WebSocket is enabled:

```typescript
try {
  // Enable WebSocket for this processing session
  console.log('[Notes Page] Enabling WebSocket for processing');
  setWsEnabled(true);
  
  // Initialize processing job state
  setProcessingJob({ /* ... */ });
  
  // ... upload logic
}
```

### 5. **Cleanup After Job Completion**

WebSocket is disabled and unsubscribed after job completes and redirects:

```typescript
setTimeout(() => {
  setProgressModalOpen(false);
  navigate({ to: '/notes/$noteId', params: { noteId } });
  
  // Clean up everything after redirect
  setProcessingJob(null);
  setSelectedFiles([]);
  setValidationError('');
  
  // Disable WebSocket and unsubscribe
  setWsEnabled(false);
  if (stopTrackingFn) {
    console.log('[Notes Page] Stopping WebSocket tracking after redirect');
    stopTrackingFn();
  }
}, 1500);
```

### 6. **Cleanup on Error**

WebSocket is also cleaned up when upload fails:

```typescript
catch (error: unknown) {
  // ... handle error
  setTimeout(() => {
    setProgressModalOpen(false);
    setProcessingJob(null);
    stopTracking();
    setSelectedFiles([]);
    setValidationError('');
    
    // Disable WebSocket and clean up on error
    setWsEnabled(false);
    console.log('[Notes Page] WebSocket disabled after upload error');
  }, 3000);
}
```

### 7. **Cleanup on Manual Modal Close**

WebSocket is cleaned up when user manually closes the progress modal:

```typescript
onOpenChange={(open) => {
  if (!open) {
    // Disable WebSocket when manually closing modal
    setWsEnabled(false);
    stopTracking();
    console.log('[Notes Page] WebSocket disabled - modal closed manually');
    
    setTimeout(() => {
      setProcessingJob(null);
      setSelectedFiles([]);
      setValidationError('');
    }, 300);
  }
}}
```

## 🔄 WebSocket Lifecycle Flow

### Before (Problem):
```
1. User uploads PDF → WebSocket enabled
2. Job processes → WebSocket subscribed
3. Job completes → WebSocket STILL subscribed ❌
4. User uploads again → WebSocket receives old job updates ❌
```

### After (Solution):
```
1. User uploads PDF → WebSocket enabled ✅
2. Job processes → WebSocket subscribed ✅
3. Job completes → WebSocket unsubscribed ✅
4. WebSocket disabled ✅
5. User uploads again → Fresh WebSocket connection ✅
```

## 📊 State Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      IDLE STATE                             │
│  wsEnabled: false                                           │
│  processingJob: null                                        │
│  WebSocket: disconnected                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ User clicks "Generate Notes"
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   PROCESSING STATE                          │
│  wsEnabled: true ✅                                         │
│  processingJob: { jobId, progress, stage, status }          │
│  WebSocket: connected & subscribed                          │
│  Progress updates: real-time via WebSocket                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Job completes or fails
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                  COMPLETION STATE                           │
│  Show success/failure UI (1.5-3 seconds)                    │
│  Redirect to note page (if successful)                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ After redirect/timeout
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLEANUP STATE                            │
│  wsEnabled: false ✅                                        │
│  stopTracking() called ✅                                   │
│  WebSocket: unsubscribed & disconnected ✅                  │
│  processingJob: null ✅                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Return to idle, ready for next upload
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      IDLE STATE                             │
│  Ready for next upload - clean slate ✅                     │
└─────────────────────────────────────────────────────────────┘
```

## ✅ Benefits

### 1. **Resource Efficiency**
- WebSocket only connected when needed
- Reduces server load and client connections
- No unnecessary Redis polling

### 2. **Clean State Management**
- Each upload starts with a fresh WebSocket connection
- No interference from previous jobs
- Predictable behavior for users

### 3. **Better User Experience**
- No confusion from old job updates
- Progress bar shows only current job
- Reliable subsequent uploads

### 4. **Debugging**
- Clear console logs for each lifecycle stage
- Easy to track WebSocket enable/disable
- Visible subscription management

## 🔍 Verification

### How to Test:

1. **First Upload**:
   ```
   - Upload a PDF
   - Check console: "Enabling WebSocket for processing"
   - Watch progress bar update in real-time
   - After completion: "Stopping WebSocket tracking after redirect"
   - Verify: wsEnabled = false
   ```

2. **Second Upload**:
   ```
   - Upload another PDF
   - Check console: "Enabling WebSocket for processing" (fresh start)
   - Verify: No old job updates appear
   - Progress bar shows only new job
   - Clean completion and cleanup
   ```

3. **Error Scenario**:
   ```
   - Upload invalid file or trigger error
   - Check console: "WebSocket disabled after upload error"
   - Verify: WebSocket cleaned up properly
   ```

4. **Manual Close**:
   ```
   - Upload PDF (after completion shows)
   - Manually close modal
   - Check console: "WebSocket disabled - modal closed manually"
   - Verify: Clean state for next upload
   ```

## 🎯 Key Principles

1. **Scope WebSocket to Processing**: Only enable during active job processing
2. **Always Clean Up**: Unsubscribe and disable after completion/failure/cancel
3. **Pass stopTracking**: Ensure callbacks can trigger cleanup
4. **Use State Flag**: Control WebSocket enable with `wsEnabled` state
5. **Log Everything**: Console logs for debugging and verification

## 📝 Console Log Messages

Look for these messages to verify proper lifecycle:

```
✅ "[Notes Page] Enabling WebSocket for processing"
   - WebSocket being enabled for new upload

✅ "[Notes Page] Stopping WebSocket tracking after redirect"
   - Cleanup after successful completion

✅ "[Notes Page] Stopping WebSocket tracking after failure"
   - Cleanup after job failure

✅ "[Notes Page] WebSocket disabled after upload error"
   - Cleanup after upload error

✅ "[Notes Page] WebSocket disabled - modal closed manually"
   - Cleanup when user closes modal
```

## 🚀 Future Improvements

1. **Multiple Concurrent Uploads**: Support multiple PDF uploads with separate WebSocket tracking
2. **Resume Capability**: Save job state to resume after page reload
3. **Batch Processing**: Process multiple PDFs sequentially with one WebSocket connection
4. **Optimistic Updates**: Show estimated progress even before WebSocket updates arrive

## 📚 Related Files

- `frontend/src/routes/__protected.notes.index.tsx` - Main implementation
- `frontend/src/hooks/useJobWebSocket.ts` - WebSocket hook
- `frontend/src/services/WebSocketService.ts` - WebSocket service
- `frontend/src/components/ProgressBar.tsx` - Progress display component

---

**Implementation Date**: December 5, 2025
**Status**: ✅ Completed and Tested
