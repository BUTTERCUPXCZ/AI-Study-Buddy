# WebSocket Scoped Lifecycle - Test Checklist

## ✅ Testing Checklist

Use this checklist to verify the WebSocket scoped lifecycle is working correctly.

### Test 1: First Upload (Happy Path)
- [ ] Open the Notes page
- [ ] Verify: `wsEnabled` should be `false` initially
- [ ] Click "Generate Notes" and upload a PDF
- [ ] **Expected**: Console shows "Enabling WebSocket for processing"
- [ ] **Expected**: Progress modal opens with progress bar
- [ ] **Expected**: Progress updates in real-time
- [ ] **Expected**: After completion, console shows "Stopping WebSocket tracking after redirect"
- [ ] **Expected**: Redirects to note detail page
- [ ] **Expected**: `wsEnabled` is now `false` again
- [ ] **Result**: ✅ Pass / ❌ Fail

### Test 2: Second Upload (Clean State)
- [ ] Navigate back to Notes page
- [ ] Verify: `wsEnabled` should be `false` (clean slate)
- [ ] Click "Generate Notes" and upload another PDF
- [ ] **Expected**: Console shows "Enabling WebSocket for processing" (fresh start)
- [ ] **Expected**: No old job updates appear in progress
- [ ] **Expected**: Progress bar shows only new job
- [ ] **Expected**: Proper completion and cleanup
- [ ] **Result**: ✅ Pass / ❌ Fail

### Test 3: Error Handling
- [ ] Upload a file that will cause an error (or simulate error)
- [ ] **Expected**: Error state shows in progress modal
- [ ] **Expected**: Console shows "WebSocket disabled after upload error"
- [ ] **Expected**: Modal closes after 3 seconds
- [ ] **Expected**: `wsEnabled` is `false`
- [ ] **Expected**: Next upload works cleanly
- [ ] **Result**: ✅ Pass / ❌ Fail

### Test 4: Manual Modal Close
- [ ] Upload a PDF and wait for completion
- [ ] **Expected**: Success state shows briefly
- [ ] Manually close the modal by clicking the X or outside
- [ ] **Expected**: Console shows "WebSocket disabled - modal closed manually"
- [ ] **Expected**: `wsEnabled` is `false`
- [ ] **Expected**: Clean state for next upload
- [ ] **Result**: ✅ Pass / ❌ Fail

### Test 5: Network Reconnection
- [ ] Start uploading a PDF
- [ ] Disable network briefly (simulate disconnect)
- [ ] **Expected**: Falls back to polling
- [ ] Re-enable network
- [ ] **Expected**: WebSocket reconnects
- [ ] **Expected**: Job completes successfully
- [ ] **Expected**: Proper cleanup after completion
- [ ] **Result**: ✅ Pass / ❌ Fail

### Test 6: Multiple Sequential Uploads
- [ ] Upload PDF #1
- [ ] Wait for completion and redirect
- [ ] Return to Notes page
- [ ] Upload PDF #2 immediately
- [ ] **Expected**: Each upload has isolated WebSocket session
- [ ] **Expected**: No cross-contamination of progress updates
- [ ] **Expected**: All uploads complete successfully
- [ ] **Result**: ✅ Pass / ❌ Fail

### Test 7: Browser DevTools Verification
- [ ] Open browser DevTools → Console tab
- [ ] Start an upload
- [ ] Look for these logs in order:
  - [ ] `"[Notes Page] Enabling WebSocket for processing"`
  - [ ] `"[useJobWebSocket] Connected to WebSocket"`
  - [ ] `"[useJobWebSocket] Subscribing to user: [userId]"`
  - [ ] `"[NotesIndex] Tracking job: [jobId]"`
  - [ ] `"[NotesIndex] Received job progress update:"`
  - [ ] `"[Notes Page] Job completed with noteId: [noteId]"`
  - [ ] `"[Notes Page] Redirecting to note: [noteId]"`
  - [ ] `"[Notes Page] Stopping WebSocket tracking after redirect"`
- [ ] **Result**: ✅ Pass / ❌ Fail

### Test 8: React DevTools State Inspection
- [ ] Install React DevTools if not already
- [ ] Select the `RouteComponent` (Notes page component)
- [ ] Before upload: verify `wsEnabled: false`
- [ ] During upload: verify `wsEnabled: true`
- [ ] After completion: verify `wsEnabled: false`
- [ ] Verify `processingJob` is `null` after cleanup
- [ ] **Result**: ✅ Pass / ❌ Fail

---

## 🐛 Common Issues & Solutions

### Issue 1: WebSocket stays subscribed after completion
**Symptom**: Old job updates appear on new uploads
**Solution**: Ensure `stopTracking()` is being called in cleanup
**Check**: Console should show "Stopping WebSocket tracking"

### Issue 2: Progress not updating
**Symptom**: Progress bar stuck at 0%
**Solution**: Verify `wsEnabled` is `true` during processing
**Check**: Console should show "Enabling WebSocket for processing"

### Issue 3: Multiple job updates showing
**Symptom**: Progress jumps or shows mixed updates
**Solution**: Verify `wsEnabled` is `false` before new upload
**Check**: Old subscriptions should be cleaned up

### Issue 4: Modal won't close
**Symptom**: Can't close modal during processing
**Solution**: This is expected behavior to prevent interruption
**Check**: Modal should be closable after completion/failure

---

## 📊 Success Criteria

All tests should pass with:
- ✅ Clean WebSocket lifecycle (enable → subscribe → unsubscribe → disable)
- ✅ No old job updates on new uploads
- ✅ Proper cleanup in all scenarios (success, failure, manual close)
- ✅ Console logs match expected flow
- ✅ React state matches expected values

---

## 🔧 Debugging Tips

### Enable Verbose Logging
Add this to your browser console before testing:
```javascript
localStorage.setItem('debug', 'websocket:*');
```

### Monitor WebSocket Connection
In Chrome DevTools:
1. Go to Network tab
2. Filter by "WS" (WebSocket)
3. Watch connection lifecycle during uploads

### Check React Query Cache
In React Query DevTools:
- Watch `['notes', userId]` cache invalidation
- Verify cache updates after job completion

---

**Last Updated**: December 5, 2025
**Tester**: _______________
**Date Tested**: _______________
