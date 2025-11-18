# Modal Auto-Close - Quick Test Checklist

## Before Testing
- [ ] Make sure backend is running
- [ ] Make sure frontend is running
- [ ] Open browser console (F12)
- [ ] Clear any previous alerts/dialogs

## Test Case 1: Successful Upload

### Steps:
1. [ ] Click "Upload PDF" button
2. [ ] Select a PDF file (e.g., "COMPUTER NETWORKING.pdf")
3. [ ] Click "Generate Notes"

### Expected Results:
- [ ] Upload drawer closes
- [ ] Processing modal appears
- [ ] Progress bar shows: "Processing PDF..." (10%)
- [ ] Progress updates: "Downloading PDF..." (20%)
- [ ] Progress updates: "Analyzing PDF with AI" (40%)
- [ ] Progress updates: "Notes generated successfully" (90%)
- [ ] Progress reaches 100%
- [ ] **Modal closes IMMEDIATELY** ✅
- [ ] Notes list refreshes with new note
- [ ] Alert appears: "Study notes generated successfully!"

### Console Logs Should Show:
```
[useJobWebSocket] Job completed, invalidating notes for userId: xxx
[useJobWebSocket] Notes query invalidated and refetch triggered
[Notes Page] Job completed callback triggered
[Notes Page] Current notes count: X
[Notes Page] Manually refetching notes...
```

### Backend Logs Should Show:
```
[PdfNotesWorker] Job xxx progress: 100%
[JobsWebSocketGateway] Job progress update for job xxx: 100%
[JobsWebSocketGateway] Job completed notification sent for job xxx
[PdfNotesWorker] Job xxx completed successfully - Notes generated from PDF
```

### Timing Check:
- [ ] Modal closes within 100-200ms of job completion
- [ ] No awkward pause with modal stuck open
- [ ] Alert appears ~300ms after completion
- [ ] Notes list updates smoothly

## Test Case 2: WebSocket Connection

### During Upload:
- [ ] Check console - should see WebSocket "Live" indicator
- [ ] Green "Live" badge on modal
- [ ] Real-time progress updates (no 3-second delay)

### If Disconnected:
- [ ] Modal shows "Polling mode" with amber badge
- [ ] Progress still updates (every 3 seconds)
- [ ] Modal still closes on completion

## Test Case 3: Multiple Uploads

### Steps:
1. [ ] Upload first PDF → Wait for completion → Modal closes
2. [ ] Upload second PDF → Wait for completion → Modal closes
3. [ ] Check notes list shows both new notes

### Expected:
- [ ] Each upload opens and closes modal correctly
- [ ] No state leaks between uploads
- [ ] Notes list updates after each upload

## Test Case 4: Quick Navigation

### Steps:
1. [ ] Start uploading PDF
2. [ ] While processing, try to navigate away (not recommended but test anyway)
3. [ ] Come back to notes page

### Expected:
- [ ] WebSocket stays connected
- [ ] Job tracking continues
- [ ] Modal closes when you return if job completed

## Common Issues to Watch For

### ❌ Modal Doesn't Close
**Check:**
- Console for callback triggers
- Backend logs for completion event
- WebSocket connection status
- `isProcessingState` value

### ❌ Notes Don't Update
**Check:**
- Network tab for GET /notes request
- Console for refetch logs
- Query invalidation logs

### ❌ Alert Blocks Modal Close
**Check:**
- Alert should appear AFTER modal closes
- Should see modal close animation first

## Browser Console Commands

Check current state:
```javascript
// Check processing state
console.log('Processing:', isProcessing);
console.log('State:', isProcessingState);

// Check job progress
console.log('Job Progress:', jobProgress);

// Force refetch
refetchNotes();
```

## Success Criteria

✅ **All tests pass if:**
1. Modal opens on upload
2. Progress updates in real-time (or via polling)
3. **Modal closes IMMEDIATELY when job completes**
4. Notes list refreshes automatically
5. Success alert appears after modal closes
6. No console errors
7. No stuck modals
8. Clean state between uploads

## Performance Metrics

- **Modal Open → Close:** ~35-40 seconds (job processing time)
- **Job Complete → Modal Close:** < 200ms ✅
- **Modal Close → Alert:** ~300ms
- **Modal Close → Notes Refresh:** ~200-400ms

---

**If all tests pass:** ✅ Modal auto-close is working perfectly!

**If any test fails:** Check the troubleshooting section in `MODAL_AUTO_CLOSE_FIX.md`
