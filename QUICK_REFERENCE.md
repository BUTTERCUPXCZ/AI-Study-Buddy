# Quick Reference - Optimized Architecture

## 📦 File Locations

### Backend
```
backend/src/jobs/
├── dto/
│   └── job-event.dto.ts              ← Event types & enums
├── job-event-emitter.service.ts      ← Centralized event emitter
├── jobs.module.ts                    ← Updated with new service
└── workers/
    ├── example.worker.ts             ← Reference implementation
    ├── pdf-notes-optimized.worker.ts ← Migrate this first
    ├── pdf-extract.worker.ts         ← Then migrate these
    ├── ai-notes.worker.ts            ← Then migrate these
    └── completion.worker.ts          ← Then migrate these
```

### Frontend
```
frontend/src/
├── types/
│   └── job-events.ts                 ← Event types (mirrors backend)
├── services/
│   ├── WebSocketService.ts           ← OLD (keep for now)
│   └── WebSocketService.optimized.ts ← NEW (use this)
└── hooks/
    ├── useJobWebSocket.ts            ← OLD (keep for now)
    └── useJobWebSocket.optimized.ts  ← NEW (use this)
```

### Documentation
```
ARCHITECTURE_OPTIMIZATION.md   ← Full architecture guide (read this first!)
IMPLEMENTATION_GUIDE.md        ← Step-by-step migration guide
QUICK_REFERENCE.md            ← This file (quick lookup)
```

---

## 🎯 Common Code Patterns

### Backend: Worker Event Emission

```typescript
import { JobEventEmitterService } from '../job-event-emitter.service';
import { JobStatus, JobStage } from '../dto/job-event.dto';

@Processor('my-queue')
export class MyWorker extends WorkerHost {
  constructor(
    private readonly jobEventEmitter: JobEventEmitterService,
  ) {
    super();
  }

  async process(job: Job<MyJobDto>): Promise<MyJobResult> {
    try {
      // Progress update
      await this.jobEventEmitter.emitProgress({
        jobId: job.id!,
        userId: job.data.userId,
        status: JobStatus.ACTIVE,
        stage: JobStage.DOWNLOADING,
        progress: 20,
        message: 'Downloading file',
        metadata: { fileName: job.data.fileName },
        timestamp: new Date().toISOString(),
      });

      // ... do work ...

      // Completion
      await this.jobEventEmitter.emitCompleted({
        jobId: job.id!,
        userId: job.data.userId,
        status: JobStatus.COMPLETED,
        stage: JobStage.COMPLETED,
        progress: 100,
        result: {
          noteId: 'note-123',
          processingTimeMs: 5000,
          cacheHit: false,
        },
        timestamp: new Date().toISOString(),
      });

      return { noteId: 'note-123' };
    } catch (error) {
      // Error
      await this.jobEventEmitter.emitFailed({
        jobId: job.id!,
        userId: job.data.userId,
        status: JobStatus.FAILED,
        stage: JobStage.FAILED,
        progress: 0,
        error: {
          message: error.message,
          code: 'PROCESSING_ERROR',
          recoverable: false,
        },
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
}
```

### Frontend: WebSocket Setup

```typescript
import { webSocketService } from '@/services/WebSocketService.optimized';
import { useJobWebSocket } from '@/hooks/useJobWebSocket.optimized';

function MyComponent() {
  const { user } = useAuth();
  
  // Setup hook
  const { isConnected, jobProgress, trackJob, stopTracking, usingPolling } = useJobWebSocket({
    userId: user?.id,
    enabled: true,
    onJobCompleted: (noteId) => {
      toast.success('Notes generated!');
      navigate({ to: `/notes/${noteId}` });
    },
    onJobFailed: (error) => {
      toast.error(`Failed: ${error}`);
    },
  });

  // Start tracking a job
  const handleUpload = async (file: File) => {
    const response = await uploadPdf(file);
    trackJob(response.jobId);
  };

  return (
    <div>
      {jobProgress && (
        <ProgressBar
          progress={jobProgress.progress}
          stage={jobProgress.stage}
          isConnected={isConnected}
          usingPolling={usingPolling}
        />
      )}
    </div>
  );
}
```

---

## 📊 Job Stages Reference

### Available Stages (JobStage Enum)

| Stage | Progress | When to Use |
|-------|----------|-------------|
| `QUEUED` | 0% | Job added to queue |
| `INITIALIZING` | 5% | Job started, setting up |
| `DOWNLOADING` | 10-20% | Downloading files |
| `EXTRACTING_TEXT` | 30-40% | Parsing/extracting data |
| `CHECKING_CACHE` | 20-30% | Checking for cached results |
| `CACHE_HIT` | 90% | Using cached result (fast path) |
| `GENERATING_NOTES` | 50-70% | AI processing (notes) |
| `GENERATING_QUIZ` | 70-80% | AI processing (quiz) |
| `SAVING` | 85-95% | Saving to database |
| `CACHING` | 95-98% | Caching for future |
| `COMPLETED` | 100% | Job finished successfully |
| `FAILED` | 0% | Job failed |

### Recommended Progress Values

```typescript
const PROGRESS_MAP = {
  [JobStage.QUEUED]: 0,
  [JobStage.INITIALIZING]: 5,
  [JobStage.DOWNLOADING]: 15,
  [JobStage.EXTRACTING_TEXT]: 30,
  [JobStage.CHECKING_CACHE]: 25,
  [JobStage.CACHE_HIT]: 90,
  [JobStage.GENERATING_NOTES]: 60,
  [JobStage.GENERATING_QUIZ]: 75,
  [JobStage.SAVING]: 90,
  [JobStage.CACHING]: 95,
  [JobStage.COMPLETED]: 100,
  [JobStage.FAILED]: 0,
};
```

---

## 🔧 Common Tasks

### Add a New Worker

1. Create worker file: `backend/src/jobs/workers/my-worker.ts`
2. Inject `JobEventEmitterService` in constructor
3. Use `jobEventEmitter.emitProgress()` for updates
4. Use `jobEventEmitter.emitCompleted()` for success
5. Use `jobEventEmitter.emitFailed()` for errors
6. Register in `jobs.module.ts` providers
7. See `example.worker.ts` for full template

### Add a New Stage

1. Add to `JobStage` enum in `backend/src/jobs/dto/job-event.dto.ts`
2. Add to `JobStage` enum in `frontend/src/types/job-events.ts`
3. Add display name to `STAGE_DISPLAY_NAMES` in both files
4. Update workers to use new stage
5. Update UI to handle new stage

### Debug WebSocket Issues

```typescript
// Enable verbose logging
webSocketService.connect();

console.log('Connected:', webSocketService.isConnected());
console.log('Subscriptions:', webSocketService.getSubscriptionCount());
console.log('Pending:', webSocketService.getPendingSubscriptionCount());

// Check backend logs
// Look for: "[WS] Client connected", "[WS] Subscribed to room"
```

### Test Event Flow

```typescript
// Backend: Add logging in worker
this.logger.log(`[${job.id}] Stage: ${JobStage.DOWNLOADING}, Progress: 20%`);

// Frontend: Add logging in hook
console.log('[Hook] Job progress:', jobProgress);

// Verify events match between backend and frontend
```

---

## ⚡ Performance Tips

### Backend

```typescript
// ✅ DO: Batch database updates
await this.jobEventEmitter.emitBatchProgress([payload1, payload2, payload3]);

// ❌ DON'T: Sync database writes in worker
await db.job.update({ ... }); // Blocks worker!

// ✅ DO: Async database writes (handled by JobEventEmitter)
await this.jobEventEmitter.emitProgress({ ... }); // Non-blocking
```

### Frontend

```typescript
// ✅ DO: Use stable callback refs
const onCompleteRef = useRef(onComplete);

// ❌ DON'T: Pass callbacks directly
useEffect(() => {
  subscribe({ userId, callback: onComplete }); // Re-subscribes every render!
}, [userId, onComplete]);

// ✅ DO: Memoize callbacks
const handleComplete = useCallback((noteId) => {
  navigate({ to: `/notes/${noteId}` });
}, [navigate]);
```

---

## 🐛 Common Issues & Fixes

### Issue: Events not reaching frontend

```typescript
// Check 1: Is WebSocket connected?
console.log(webSocketService.isConnected()); // Should be true

// Check 2: Are you subscribed?
console.log(webSocketService.getSubscriptionCount()); // Should be > 0

// Check 3: Are you in the right room?
// Backend emits to: `user:${userId}` and `job:${jobId}`
// Frontend subscribes to: { userId } or { jobId }

// Fix: Subscribe to both
webSocketService.subscribe({ userId });
webSocketService.subscribe({ jobId });
```

### Issue: Duplicate subscriptions

```typescript
// Problem: Subscribing without cleanup
useEffect(() => {
  webSocketService.subscribe({ userId });
  // Missing cleanup!
}, [userId]);

// Fix: Add cleanup
useEffect(() => {
  webSocketService.subscribe({ userId });
  return () => webSocketService.unsubscribe({ userId });
}, [userId]);
```

### Issue: Worker not injecting service

```typescript
// Problem: Forgot to add to module
@Module({
  providers: [MyWorker], // ❌ JobEventEmitterService not provided!
})

// Fix: Add to module providers and imports
@Module({
  imports: [JobsModule], // Exports JobEventEmitterService
  providers: [MyWorker],
})
```

---

## 📱 Testing Checklist

### Manual Tests

- [ ] Upload PDF → Progress bar shows each stage
- [ ] Disconnect WiFi → Switches to polling automatically
- [ ] Reconnect WiFi → Switches back to WebSocket
- [ ] Job completes → Notes appear in list
- [ ] Job fails → Error message displayed
- [ ] Multiple uploads → All tracked independently
- [ ] Refresh page during job → Resumes tracking
- [ ] Cache hit → Fast completion (~1s)

### Automated Tests

```typescript
// Backend worker test
it('should emit progress events', async () => {
  const emitSpy = jest.spyOn(jobEventEmitter, 'emitProgress');
  await worker.process(mockJob);
  expect(emitSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      stage: JobStage.DOWNLOADING,
      progress: 20,
    })
  );
});

// Frontend hook test
it('should track job progress', () => {
  const { result } = renderHook(() => useJobWebSocket({ userId: 'test' }));
  act(() => {
    result.current.trackJob('job-123');
  });
  expect(result.current.jobProgress?.jobId).toBe('job-123');
});
```

---

## 🚀 Deployment Steps

1. **Backend First**
   ```bash
   cd backend
   npm run build
   npm run start:prod
   # Verify workers start successfully
   ```

2. **Frontend Second**
   ```bash
   cd frontend
   npm run build
   # Deploy build/ directory
   ```

3. **Verify**
   - Check backend logs for worker startup
   - Check frontend can connect to WebSocket
   - Test one upload end-to-end
   - Monitor error rates

---

## 📚 Additional Reading

- **Architecture Guide**: `ARCHITECTURE_OPTIMIZATION.md` (60 min read)
- **Migration Guide**: `IMPLEMENTATION_GUIDE.md` (step-by-step)
- **Example Code**: `backend/src/jobs/workers/example.worker.ts`

---

**Pro Tip:** Keep this file open while implementing for quick reference! 🎯
