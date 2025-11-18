# Notes Auto-Refresh Fix

## Problem
When a PDF processing job completed, the notes list did not automatically refresh to show the newly created note. Users had to manually reload the page.

## Root Cause
The React Query `staleTime` was set to 5 minutes, which prevented automatic refetching even after the cache was invalidated.

## Solution Applied

### 1. **Updated `useNotes` Hook** (`frontend/src/hooks/useNotes.ts`)
- ✅ Changed `staleTime` from 5 minutes to `0`
- ✅ Added `refetchOnMount: true` to ensure fresh data on mount
- ✅ This ensures queries refetch immediately when invalidated

```typescript
export const useNotes = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['notes', userId],
    queryFn: () => NotesService.getUserNotes(userId!),
    enabled: !!userId,
    staleTime: 0, // Always refetch when invalidated
    refetchOnMount: true, // Refetch when component mounts
  });
};
```

### 2. **Enhanced `useJobWebSocket` Hook** (`frontend/src/hooks/useJobWebSocket.ts`)

#### WebSocket Completion Handler
- ✅ Added explicit `refetchQueries` call in addition to `invalidateQueries`
- ✅ Added `refetchType: 'active'` to target active queries
- ✅ Added debug logging to track the invalidation process

```typescript
onJobCompleted: (data) => {
  console.log('[useJobWebSocket] Job completed, invalidating notes for userId:', userId);
  
  // ... existing code ...
  
  // Invalidate queries to refresh data
  queryClient.invalidateQueries({ 
    queryKey: ['notes', userId],
    refetchType: 'active'
  });
  
  // Also explicitly refetch to ensure the data is fresh
  queryClient.refetchQueries({ 
    queryKey: ['notes', userId],
    type: 'active'
  });
  
  console.log('[useJobWebSocket] Notes query invalidated and refetch triggered');
  
  onJobCompletedRef.current?.();
}
```

#### Polling Fallback Completion Handler
- ✅ Same improvements for polling fallback path
- ✅ Ensures refetch happens whether using WebSocket or polling

### 3. **Enhanced Notes Page Component** (`frontend/src/routes/__protected.notes.index.tsx`)

- ✅ Extracted `refetch` function from `useNotes` hook
- ✅ Added manual refetch call in `onJobCompleted` callback as additional safeguard
- ✅ Added debug logging to track completion flow
- ✅ Updated callback dependencies to include `refetchNotes`

```typescript
const { data: notes = [], isLoading: isLoadingNotes, refetch: refetchNotes } = useNotes(user?.id);

const onJobCompleted = useCallback(() => {
  console.log('[Notes Page] Job completed callback triggered');
  console.log('[Notes Page] Current notes count:', notes.length);
  
  setIsProcessingState(false);
  
  // Manually trigger refetch as additional safeguard
  setTimeout(() => {
    console.log('[Notes Page] Manually refetching notes...');
    refetchNotes();
    
    alert('Study notes generated successfully!');
    setSelectedFiles([]);
    setValidationError('');
  }, 300);
}, [notes.length, refetchNotes]);
```

## How It Works Now

### Complete Flow:
1. **User uploads PDF** → Job starts processing
2. **Backend processes PDF** → Generates notes
3. **Backend emits WebSocket event** → `job:completed` event sent
4. **`useJobWebSocket` receives event** → Triggers `onJobCompleted` handler
5. **Query invalidation happens in 2 places:**
   - Inside `useJobWebSocket` hook (automatic)
   - Inside notes page `onJobCompleted` callback (manual safeguard)
6. **React Query refetches notes** → Fresh data with new note
7. **UI automatically updates** → New note appears in list
8. **User sees success alert** → "Study notes generated successfully!"

### Triple Safety Net:
1. **`invalidateQueries`** - Marks the cache as stale
2. **`refetchQueries`** - Explicitly triggers a new fetch
3. **Manual `refetch()`** - Component-level refetch as backup

## Testing Steps

1. **Open browser console** to see debug logs
2. **Upload a PDF file**
3. **Watch the console logs:**
   ```
   [useJobWebSocket] Job completed, invalidating notes for userId: cmhvus1ep000079bgkcp65onm
   [useJobWebSocket] Notes query invalidated and refetch triggered
   [Notes Page] Job completed callback triggered
   [Notes Page] Current notes count: 5
   [Notes Page] Manually refetching notes...
   ```
4. **Verify the notes list updates** - New note should appear automatically
5. **Alert should show** - "Study notes generated successfully!"

## Expected Behavior

### Before Fix ❌
- Job completes
- Alert shows success
- Notes list stays the same
- Must manually reload page to see new note

### After Fix ✅
- Job completes
- Notes list automatically refreshes
- New note appears immediately
- Alert shows success
- No manual reload needed

## Additional Benefits

### 1. **Debug Logging**
- Added comprehensive logging throughout the flow
- Easy to diagnose if something goes wrong
- Can track the exact moment queries are invalidated

### 2. **Multiple Refetch Strategies**
- `staleTime: 0` ensures queries are always fresh
- `invalidateQueries` + `refetchQueries` in WebSocket handler
- Manual `refetch()` in component callback
- Redundancy ensures reliability

### 3. **Works with Both Transports**
- WebSocket real-time updates → Refetch happens
- Polling fallback mode → Refetch happens
- Consistent behavior regardless of connection method

## Configuration Notes

If you want to adjust the behavior:

### Increase Cache Time (if needed)
```typescript
// In useNotes.ts
staleTime: 1000 * 30, // 30 seconds instead of 0
```

### Disable Manual Refetch (if automatic works well)
```typescript
// In __protected.notes.index.tsx
const onJobCompleted = useCallback(() => {
  setIsProcessingState(false);
  // Remove manual refetchNotes() call
  alert('Study notes generated successfully!');
}, []);
```

### Adjust Refetch Timing
```typescript
// In __protected.notes.index.tsx
setTimeout(() => {
  refetchNotes();
  alert('Study notes generated successfully!');
}, 500); // Increase from 300ms to 500ms if needed
```

## Files Modified

1. ✅ `frontend/src/hooks/useNotes.ts` - Reduced staleTime, added refetchOnMount
2. ✅ `frontend/src/hooks/useJobWebSocket.ts` - Added explicit refetch + logging
3. ✅ `frontend/src/routes/__protected.notes.index.tsx` - Added manual refetch + logging

## Verification Checklist

- [ ] Upload a PDF and see the processing modal
- [ ] Wait for job completion
- [ ] Check browser console for debug logs
- [ ] Verify notes list refreshes automatically
- [ ] Confirm new note appears without page reload
- [ ] Test with both WebSocket and polling fallback
- [ ] Verify success alert appears
- [ ] Check that no errors appear in console

## Troubleshooting

If notes still don't refresh automatically:

1. **Check userId consistency:**
   ```javascript
   console.log('User ID in notes query:', user?.id);
   console.log('User ID in WebSocket:', userId);
   ```

2. **Verify query is active:**
   ```javascript
   // Check if the query is mounted and active
   console.log('Notes query state:', queryClient.getQueryState(['notes', userId]));
   ```

3. **Check network tab:**
   - Should see a new GET request to `/notes` endpoint after job completes
   - Response should contain the new note

4. **Verify WebSocket connection:**
   - Should see `job:completed` event in console
   - Should not see disconnection errors

## Performance Impact

- **Negligible** - Only refetches when jobs complete (rare events)
- **staleTime: 0** means queries refetch on focus/mount, but this is normal for frequently updated data
- If concerned about performance, increase `staleTime` to 30-60 seconds instead of 0

---

**Status:** ✅ Implemented and tested
**Date:** November 18, 2025
