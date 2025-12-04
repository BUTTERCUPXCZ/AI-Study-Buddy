# Implementation Guide - Migrating to Optimized Architecture

## 📋 Overview

This guide walks you through migrating your existing background job processing and WebSocket system to the optimized architecture. Follow these steps in order for a smooth transition.

## ⚙️ Prerequisites

- [ ] Review `ARCHITECTURE_OPTIMIZATION.md` for understanding
- [ ] Backup your current codebase
- [ ] Test in development environment first
- [ ] Have database migrations ready if needed

## 🎯 Migration Steps

### Phase 1: Backend Setup (Estimated Time: 2-3 hours)

#### Step 1.1: Install/Verify Dependencies

```bash
cd backend
npm install @nestjs/bullmq bullmq ioredis @nestjs/websockets socket.io
```

#### Step 1.2: Add New Files

These files have been created for you:

```
backend/src/jobs/
├── dto/
│   └── job-event.dto.ts ✅ (CREATED)
├── job-event-emitter.service.ts ✅ (CREATED)
└── workers/
    └── example.worker.ts ✅ (REFERENCE)
```

#### Step 1.3: Update JobsModule

The JobsModule has been updated to include:
- ✅ `JobEventEmitterService` in providers
- ✅ `JobEventEmitterService` in exports

Verify in `backend/src/jobs/jobs.module.ts`:

```typescript
providers: [
  JobsService,
  JobEventEmitterService, // ✅ Added
  // ... other providers
],
exports: [
  JobsService,
  JobEventEmitterService, // ✅ Added
  // ... other exports
],
```

#### Step 1.4: Migrate One Worker (Test)

Let's migrate `pdf-notes-optimized.worker.ts` as a proof of concept.

**Current Pattern:**
```typescript
// OLD - Direct WebSocket calls
await this.updateProgress(job, 20, 'downloading');
this.wsGateway.emitJobProgress(job.id!, 20, 'downloading', userId);
```

**New Pattern:**
```typescript
// NEW - Centralized event emitter
await this.jobEventEmitter.emitProgress({
  jobId: job.id!,
  userId: job.data.userId,
  status: JobStatus.ACTIVE,
  stage: JobStage.DOWNLOADING,
  progress: 20,
  message: 'Downloading PDF from storage',
  timestamp: new Date().toISOString(),
});
```

**Implementation:**

1. Open `backend/src/jobs/workers/pdf-notes-optimized.worker.ts`

2. Add imports at the top:
```typescript
import { JobEventEmitterService } from '../job-event-emitter.service';
import { JobStatus, JobStage } from '../dto/job-event.dto';
```

3. Inject `JobEventEmitterService` in constructor:
```typescript
constructor(
  private readonly configService: ConfigService,
  private readonly databaseService: DatabaseService,
  private readonly jobsService: JobsService,
  private readonly aiService: AiService,
  private readonly wsGateway: JobsWebSocketGateway,
  private readonly notesService: NotesService,
  private readonly jobEventEmitter: JobEventEmitterService, // ADD THIS
) {
  super();
  // ... rest of constructor
}
```

4. Replace all `updateProgress()` calls with `jobEventEmitter.emitProgress()`:

```typescript
// REPLACE THIS:
await this.updateProgress(job, 5, 'initializing');

// WITH THIS:
await this.jobEventEmitter.emitProgress({
  jobId: job.id!,
  userId: job.data.userId,
  status: JobStatus.ACTIVE,
  stage: JobStage.INITIALIZING,
  progress: 5,
  message: 'Starting PDF processing',
  metadata: { fileName: job.data.fileName },
  timestamp: new Date().toISOString(),
});
```

5. Replace completion event:

```typescript
// REPLACE THIS:
await this.wsGateway.emitJobCompleted(job.id!, result);

// WITH THIS:
await this.jobEventEmitter.emitCompleted({
  jobId: job.id!,
  userId: job.data.userId,
  status: JobStatus.COMPLETED,
  stage: JobStage.COMPLETED,
  progress: 100,
  result: {
    noteId: result.noteId,
    title: result.title,
    processingTimeMs: result.processingTime,
    cacheHit: result.cacheHit,
  },
  timestamp: new Date().toISOString(),
});
```

6. Replace error handling:

```typescript
// REPLACE THIS:
await this.handleError(job, error);

// WITH THIS:
await this.jobEventEmitter.emitFailed({
  jobId: job.id!,
  userId: job.data.userId,
  status: JobStatus.FAILED,
  stage: JobStage.FAILED,
  progress: 0,
  error: {
    message: error.message,
    code: 'PDF_PROCESSING_ERROR',
    recoverable: false,
  },
  timestamp: new Date().toISOString(),
});
```

7. Test the worker:

```bash
# In backend directory
npm run start:dev

# Upload a PDF and watch the logs
# Look for consistent event format in logs
```

#### Step 1.5: Migrate Remaining Workers

Once the test worker works, apply the same pattern to:
- `pdf-extract.worker.ts`
- `ai-notes.worker.ts`
- `completion.worker.ts`

Use the example worker (`example.worker.ts`) as a reference.

#### Step 1.6: Test Backend Events

Create a test script to verify events:

```typescript
// backend/test-events.ts
import { webSocketService } from '../frontend/src/services/WebSocketService.optimized';

webSocketService.connect();

webSocketService.on({
  onJobProgress: (data) => {
    console.log('Progress:', data);
    console.assert(data.jobId, 'jobId missing');
    console.assert(data.userId, 'userId missing');
    console.assert(data.stage, 'stage missing');
    console.assert(typeof data.progress === 'number', 'progress not a number');
  },
  onJobCompleted: (data) => {
    console.log('Completed:', data);
    console.assert(data.result, 'result missing');
  },
});

webSocketService.subscribe({ userId: 'test-user-123' });
```

### Phase 2: Frontend Setup (Estimated Time: 1-2 hours)

#### Step 2.1: Add New Frontend Files

These files have been created for you:

```
frontend/src/
├── types/
│   └── job-events.ts ✅ (CREATED)
├── services/
│   └── WebSocketService.optimized.ts ✅ (CREATED)
└── hooks/
    └── useJobWebSocket.optimized.ts ✅ (CREATED)
```

#### Step 2.2: Update Import Paths

**Option A: Gradual Migration** (Recommended)

Keep existing files and gradually switch imports:

```typescript
// Change from:
import { useJobWebSocket } from '@/hooks/useJobWebSocket';

// To:
import { useJobWebSocket } from '@/hooks/useJobWebSocket.optimized';
```

**Option B: Full Replacement**

Replace the existing files:

```bash
cd frontend/src

# Backup old files
mv services/WebSocketService.ts services/WebSocketService.old.ts
mv hooks/useJobWebSocket.ts hooks/useJobWebSocket.old.ts

# Rename optimized files
mv services/WebSocketService.optimized.ts services/WebSocketService.ts
mv hooks/useJobWebSocket.optimized.ts hooks/useJobWebSocket.ts
```

#### Step 2.3: Update Component Usage

Update your components to use the optimized hook:

**Before:**
```typescript
const {
  isConnected,
  jobProgress,
  connectionError,
  trackJob,
  stopTracking,
  usingPolling,
} = useJobWebSocket({
  userId: user?.id,
  enabled: true,
  onJobCompleted: (noteId) => {
    console.log('Job completed:', noteId);
  },
  onJobFailed: () => {
    toast.error('Job failed');
  },
});
```

**After:**
```typescript
// Same API, but now uses optimized service
const {
  isConnected,
  jobProgress,
  trackJob,
  stopTracking,
  usingPolling,
} = useJobWebSocket({
  userId: user?.id,
  enabled: true,
  onJobCompleted: (noteId) => {
    console.log('Job completed:', noteId);
    navigate({ to: `/notes/${noteId}` });
  },
  onJobFailed: (error) => {
    toast.error(`Job failed: ${error}`);
  },
});
```

#### Step 2.4: Update Progress Display

Use the new typed stage enums:

```typescript
import { JobStage, STAGE_DISPLAY_NAMES } from '@/types/job-events';

// In your component:
const getStageLabel = (stage: string) => {
  return STAGE_DISPLAY_NAMES[stage as JobStage] || stage;
};

// In JSX:
<p>{getStageLabel(jobProgress?.stage)}</p>
```

#### Step 2.5: Test Frontend

```bash
cd frontend
npm run dev
```

Test scenarios:
- [ ] Upload PDF → See progress updates
- [ ] Disconnect WiFi mid-upload → Should switch to polling
- [ ] Reconnect WiFi → Should resume WebSocket
- [ ] Job completes → Notes list updates automatically
- [ ] Multiple uploads → Each tracked separately

### Phase 3: End-to-End Testing (Estimated Time: 1 hour)

#### Test Matrix

| Test Case | Expected Behavior | Status |
|-----------|------------------|--------|
| Happy path upload | Progress → Complete → Notes appear | ⬜ |
| Cache hit | Fast completion (~1s) | ⬜ |
| WebSocket disconnect | Switch to polling automatically | ⬜ |
| WebSocket reconnect | Resume WebSocket, stop polling | ⬜ |
| Job failure | Error message displayed | ⬜ |
| Multiple concurrent jobs | All tracked independently | ⬜ |
| Page refresh during job | Resume tracking on reload | ⬜ |
| Network offline | Graceful fallback to polling | ⬜ |

#### Test Script

```typescript
// frontend/src/test/websocket-test.ts
import { webSocketService } from '@/services/WebSocketService.optimized';

async function runTests() {
  console.log('🧪 Starting WebSocket tests...');

  // Test 1: Connection
  webSocketService.connect();
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.assert(webSocketService.isConnected(), '❌ Not connected');
  console.log('✅ Test 1: Connection');

  // Test 2: Subscription
  webSocketService.subscribe({ userId: 'test-user' });
  console.assert(webSocketService.getSubscriptionCount() === 1, '❌ Not subscribed');
  console.log('✅ Test 2: Subscription');

  // Test 3: Deduplication
  webSocketService.subscribe({ userId: 'test-user' });
  console.assert(webSocketService.getSubscriptionCount() === 1, '❌ Duplicate subscription');
  console.log('✅ Test 3: Deduplication');

  // Test 4: Multiple subscriptions
  webSocketService.subscribe({ jobId: 'job-123' });
  console.assert(webSocketService.getSubscriptionCount() === 2, '❌ Wrong count');
  console.log('✅ Test 4: Multiple subscriptions');

  // Test 5: Unsubscribe
  webSocketService.unsubscribe({ userId: 'test-user' });
  console.assert(webSocketService.getSubscriptionCount() === 1, '❌ Not unsubscribed');
  console.log('✅ Test 5: Unsubscribe');

  console.log('🎉 All tests passed!');
}

runTests();
```

### Phase 4: Cleanup (Estimated Time: 30 minutes)

#### Step 4.1: Remove Old Code

Once everything works:

```bash
# Backend
rm backend/src/jobs/workers/example.worker.ts

# Frontend (if you did full replacement)
rm frontend/src/services/WebSocketService.old.ts
rm frontend/src/hooks/useJobWebSocket.old.ts
```

#### Step 4.2: Update Documentation

Add README files:

```bash
# Backend
echo "See ARCHITECTURE_OPTIMIZATION.md for details" > backend/src/jobs/README.md

# Frontend
echo "See job-events.ts for type definitions" > frontend/src/types/README.md
```

#### Step 4.3: Code Review Checklist

- [ ] All workers use `JobEventEmitterService`
- [ ] All workers use `JobStage` enum (not free strings)
- [ ] All events include `timestamp`
- [ ] All events include `userId` and `jobId`
- [ ] Frontend uses optimized `WebSocketService`
- [ ] Frontend uses typed stage enums
- [ ] No hardcoded stage strings in UI
- [ ] Error handling includes error codes
- [ ] Polling fallback tested and works
- [ ] Reconnection tested and works

### Phase 5: Monitoring & Optimization (Ongoing)

#### Step 5.1: Add Metrics

```typescript
// backend/src/jobs/job-event-emitter.service.ts

import { Counter, Histogram } from 'prom-client';

private readonly jobEventCounter = new Counter({
  name: 'job_events_total',
  help: 'Total number of job events emitted',
  labelNames: ['stage', 'status'],
});

private readonly jobDurationHistogram = new Histogram({
  name: 'job_duration_seconds',
  help: 'Job processing duration',
  labelNames: ['status', 'cache_hit'],
  buckets: [1, 3, 5, 10, 30, 60, 120],
});

async emitProgress(payload: JobProgressPayload): Promise<void> {
  this.jobEventCounter.inc({ stage: payload.stage, status: payload.status });
  // ... rest of method
}
```

#### Step 5.2: Add Logging

Use structured logging for better observability:

```typescript
this.logger.log({
  message: 'Job progress update',
  jobId: payload.jobId,
  userId: payload.userId,
  stage: payload.stage,
  progress: payload.progress,
  processingTimeMs: Date.now() - startTime,
});
```

#### Step 5.3: Set Up Alerts

Configure alerts for:
- Job failure rate > 5%
- Average job duration > 30s
- WebSocket disconnection rate > 10%
- Queue depth > 100 jobs

## 🎉 Completion Checklist

### Backend
- [ ] All workers migrated to `JobEventEmitterService`
- [ ] All workers use `JobStage` enum
- [ ] Events are structured and consistent
- [ ] Error handling includes codes and recovery info
- [ ] Logs are structured and searchable
- [ ] Tests pass

### Frontend
- [ ] Using optimized `WebSocketService`
- [ ] Using optimized `useJobWebSocket` hook
- [ ] UI displays typed stage names
- [ ] Polling fallback works
- [ ] Reconnection works
- [ ] Tests pass

### Testing
- [ ] Happy path works
- [ ] Error scenarios handled gracefully
- [ ] Network issues handled (disconnect, reconnect)
- [ ] Multiple concurrent jobs work
- [ ] Cache hit scenario works
- [ ] Performance meets targets (< 10s per job)

### Documentation
- [ ] Updated README files
- [ ] Added inline comments
- [ ] Documented environment variables
- [ ] Created troubleshooting guide

## 🔧 Troubleshooting

### Issue: Events not reaching frontend

**Check:**
1. Backend logs show events being emitted?
2. WebSocket connected? (check `webSocketService.isConnected()`)
3. Subscribed to correct room? (check `webSocketService.getSubscriptionCount()`)
4. Firewall blocking WebSocket port?

**Solution:**
```typescript
// Enable debug logging
webSocketService.connect({ transports: ['websocket'] });
```

### Issue: Duplicate subscriptions

**Check:**
1. Are you calling `subscribe()` in render loop?
2. Are you calling `subscribe()` without cleanup?

**Solution:**
```typescript
// Use effect with proper cleanup
useEffect(() => {
  webSocketService.subscribe({ userId });
  return () => {
    webSocketService.unsubscribe({ userId });
  };
}, [userId]);
```

### Issue: Worker events not emitting

**Check:**
1. Did you inject `JobEventEmitterService` in constructor?
2. Did you add it to module providers?
3. Are you calling `await jobEventEmitter.emitProgress(...)`?

**Solution:**
Verify module exports:
```typescript
@Module({
  providers: [JobEventEmitterService],
  exports: [JobEventEmitterService],
})
```

## 📚 Additional Resources

- `ARCHITECTURE_OPTIMIZATION.md` - Full architecture guide
- `backend/src/jobs/dto/job-event.dto.ts` - Event type definitions
- `backend/src/jobs/workers/example.worker.ts` - Reference implementation
- `frontend/src/types/job-events.ts` - Frontend types

## 🆘 Need Help?

If you encounter issues:
1. Check logs (backend and frontend console)
2. Verify all files are in place
3. Check dependencies are installed
4. Review the example worker
5. Test with a simple upload first

---

**Remember:** Migrate gradually, test frequently, and keep your old code until you're confident everything works!
