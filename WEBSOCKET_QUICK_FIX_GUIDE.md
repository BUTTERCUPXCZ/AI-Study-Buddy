# WebSocket Scoped Lifecycle - Quick Reference

## 🎯 What Changed?

**Before**: WebSocket was always enabled and never properly cleaned up after job completion.

**After**: WebSocket only runs during PDF processing and automatically unsubscribes after completion.

---

## 🔑 Key Changes

### 1. New State Variable
```typescript
const [wsEnabled, setWsEnabled] = useState(false)
```

### 2. Dynamic WebSocket Enable
```typescript
const { jobProgress, trackJob, stopTracking, isConnected, usingPolling } = useJobWebSocket({
  userId: user?.id,
  enabled: wsEnabled, // ✅ Now dynamic, not always true
  onJobCompleted: (noteId?: string) => onJobCompleted(noteId, stopTracking),
  onJobFailed: () => onJobFailed(stopTracking),
});
```

### 3. Enable on Upload Start
```typescript
// When user clicks "Generate Notes"
setWsEnabled(true); // ✅ Enable WebSocket
```

### 4. Disable After Completion
```typescript
// After job completes and redirects
setWsEnabled(false);      // ✅ Disable WebSocket
stopTrackingFn();         // ✅ Unsubscribe
```

---

## 📋 Lifecycle Stages

```
IDLE → UPLOAD → PROCESSING → COMPLETE → CLEANUP → IDLE
  ↓       ↓          ↓           ↓          ↓        ↓
 WS:OFF  WS:ON    WS:ON       WS:ON     WS:OFF   WS:OFF
         Sub     Receive     Success    Unsub    Ready
                 Updates
```

---

## 🔍 Quick Debugging

### Check WebSocket State
Open React DevTools → Components → Select `RouteComponent` → Check state:
- `wsEnabled`: Should be `true` only during processing
- `processingJob`: Should be `null` when idle

### Console Logs to Look For

**✅ Good Flow**:
```
1. "Enabling WebSocket for processing"
2. "Connected to WebSocket"
3. "Subscribing to user: [id]"
4. "Tracking job: [jobId]"
5. Multiple progress updates...
6. "Job completed with noteId: [id]"
7. "Redirecting to note: [id]"
8. "Stopping WebSocket tracking after redirect"
```

**❌ Problem Flow**:
```
- Missing "Stopping WebSocket tracking" → Cleanup not happening
- "WebSocket connected" when idle → Should be disconnected
- Old job updates on new upload → Previous subscription not cleaned
```

---

## 🎓 Common Scenarios

### Scenario 1: Normal Upload
```typescript
User uploads PDF
→ wsEnabled = true
→ WebSocket connects
→ Subscribe to job updates
→ Job completes
→ Show success (1.5s)
→ Redirect to note
→ wsEnabled = false
→ Unsubscribe
→ Ready for next upload ✅
```

### Scenario 2: Upload Error
```typescript
User uploads PDF
→ wsEnabled = true
→ Upload fails
→ Show error (3s)
→ wsEnabled = false
→ Unsubscribe
→ Ready for retry ✅
```

### Scenario 3: Manual Close
```typescript
User uploads PDF
→ wsEnabled = true
→ Job completes
→ User closes modal manually
→ wsEnabled = false
→ Unsubscribe
→ Ready for next upload ✅
```

---

## 🛠️ Troubleshooting

### Problem: WebSocket stays connected after upload
**Cause**: `setWsEnabled(false)` not being called
**Fix**: Check all cleanup paths (success, failure, manual close)
**Verify**: Add console.log before `setWsEnabled(false)`

### Problem: Old job updates appear on new upload
**Cause**: `stopTracking()` not being called
**Fix**: Ensure `stopTrackingFn()` is called in cleanup
**Verify**: Console should show "Stopping WebSocket tracking"

### Problem: Progress not updating
**Cause**: `wsEnabled` is still `false`
**Fix**: Check that `setWsEnabled(true)` is called before upload
**Verify**: React DevTools should show `wsEnabled: true` during processing

### Problem: Multiple progress bars or mixed updates
**Cause**: Previous WebSocket subscription not cleaned up
**Fix**: Ensure complete cleanup before allowing new upload
**Verify**: `processingJob` should be `null` before new upload starts

---

## 📚 Related Files

- **Main Implementation**: `frontend/src/routes/__protected.notes.index.tsx`
- **WebSocket Hook**: `frontend/src/hooks/useJobWebSocket.ts`
- **Documentation**: 
  - `WEBSOCKET_SCOPED_LIFECYCLE.md` - Full documentation
  - `WEBSOCKET_TEST_CHECKLIST.md` - Testing guide

---

## 🚀 Testing Commands

```bash
# Start frontend (if not running)
cd frontend
npm run dev

# Open browser DevTools (F12)
# Go to Console tab
# Monitor logs during upload

# Optional: Enable verbose WebSocket logging
localStorage.setItem('debug', 'websocket:*')
```

---

## ✅ Success Indicators

- [ ] WebSocket only connects during upload
- [ ] Clean console logs with proper lifecycle
- [ ] No old job updates on subsequent uploads
- [ ] Progress bar shows only current job
- [ ] Modal closes and redirects properly
- [ ] React state is clean between uploads

---

**Quick Win**: Test with two consecutive uploads. If the second upload shows clean progress without any old job updates, the implementation is working correctly! ✅

---

**Created**: December 5, 2025
**Status**: ✅ Implementation Complete
