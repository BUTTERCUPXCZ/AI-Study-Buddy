# Notes Auto-Refresh - Quick Reference

## What Was Fixed?
Notes list now automatically refreshes when PDF processing completes. No manual page reload needed.

## Key Changes

### 1. useNotes Hook - Reduced Cache Time
```typescript
staleTime: 0, // Was: 1000 * 60 * 5 (5 minutes)
refetchOnMount: true
```

### 2. useJobWebSocket Hook - Added Explicit Refetch
```typescript
// Both invalidate AND refetch
queryClient.invalidateQueries({ queryKey: ['notes', userId] });
queryClient.refetchQueries({ queryKey: ['notes', userId] });
```

### 3. Notes Page - Added Manual Refetch Backup
```typescript
const { refetch: refetchNotes } = useNotes(user?.id);

const onJobCompleted = useCallback(() => {
  refetchNotes(); // Manual trigger as backup
}, [refetchNotes]);
```

## Flow Diagram

```
PDF Upload → Job Processing → Job Completed
                                    ↓
                        WebSocket Event Received
                                    ↓
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
        invalidateQueries(['notes'])    onJobCompleted callback
                    ↓                               ↓
        refetchQueries(['notes'])           refetchNotes()
                    └───────────────┬───────────────┘
                                    ↓
                          Notes List Updates! ✅
```

## Testing

1. **Upload PDF** → Start processing
2. **Wait for completion** → Watch console logs
3. **Verify refresh** → New note appears automatically
4. **No reload needed** → Success! ✅

## Console Logs to Expect

```
[useJobWebSocket] Job completed, invalidating notes for userId: xxx
[useJobWebSocket] Notes query invalidated and refetch triggered
[Notes Page] Job completed callback triggered
[Notes Page] Current notes count: 5
[Notes Page] Manually refetching notes...
```

## If Issues Persist

1. Check `user?.id` is consistent
2. Verify WebSocket connection is active
3. Check Network tab for GET `/notes` request after completion
4. Look for any console errors

## Files Changed
- ✅ `frontend/src/hooks/useNotes.ts`
- ✅ `frontend/src/hooks/useJobWebSocket.ts`
- ✅ `frontend/src/routes/__protected.notes.index.tsx`

---
**Triple Safety Net:** invalidateQueries + refetchQueries + manual refetch()
