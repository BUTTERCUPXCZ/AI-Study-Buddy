# Worker Optimization Implementation Roadmap

## Phase 1: Quick Wins (30 minutes - 2 hours)

### Step 1: Update Worker Configurations

Apply these settings to all existing workers for immediate performance gains.

#### File: `pdf-notes-optimized.worker.ts`
```typescript
// Current (line 53)
@Processor('pdf-notes-optimized', {
  concurrency: 15,
  stalledInterval: 120000,
  maxStalledCount: 1,
  lockDuration: 120000,
  lockRenewTime: 60000,
  drainDelay: 20,
  limiter: {
    max: 25,
    duration: 1000,
  },
})

// Optimized ✅
@Processor('pdf-notes-optimized', {
  concurrency: 20, // Increased for better throughput
  stalledInterval: 120000,
  maxStalledCount: 1,
  lockDuration: 120000,
  lockRenewTime: 60000,
  drainDelay: 10, // Faster polling
  limiter: {
    max: 30, // Higher rate limit
    duration: 1000,
    bounceBack: false, // Don't requeue on limit
  },
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      return Math.min(1000 * Math.pow(2, attemptsMade), 60000);
    },
  },
})
```

#### File: `ai-notes.worker.ts`
```typescript
// Current (line 12)
@Processor('ai-notes', {
  concurrency: 2,
  stalledInterval: 60000,
  maxStalledCount: 1,
  lockDuration: 60000,
  lockRenewTime: 30000,
  drainDelay: 60, // Too slow!
})

// Optimized ✅
@Processor('ai-notes', {
  concurrency: 5, // AI is I/O-bound (waiting on API)
  stalledInterval: 120000,
  maxStalledCount: 1,
  lockDuration: 120000,
  lockRenewTime: 60000,
  drainDelay: 15, // Much faster
  limiter: {
    max: 10,
    duration: 1000,
  },
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      return Math.min(2000 * Math.pow(2, attemptsMade), 60000);
    },
  },
})
```

#### File: `pdf-extract.worker.ts`
```typescript
// Current (line 17)
@Processor('pdf-extract', {
  concurrency: 3,
  stalledInterval: 60000,
  maxStalledCount: 1,
  lockDuration: 60000,
  lockRenewTime: 30000,
  drainDelay: 60, // Too slow!
})

// Optimized ✅
@Processor('pdf-extract', {
  concurrency: 8, // Higher for I/O-bound downloads
  stalledInterval: 120000,
  maxStalledCount: 1,
  lockDuration: 120000,
  lockRenewTime: 60000,
  drainDelay: 15,
  limiter: {
    max: 15,
    duration: 1000,
  },
})
```

#### File: `completion.worker.ts`
```typescript
// Current (line 9)
@Processor('completion', {
  concurrency: 5,
  stalledInterval: 60000,
  maxStalledCount: 1,
  lockDuration: 60000,
  lockRenewTime: 30000,
  drainDelay: 60, // Too slow!
})

// Optimized ✅
@Processor('completion', {
  concurrency: 10, // Lightweight operations
  stalledInterval: 120000,
  maxStalledCount: 1,
  lockDuration: 60000,
  lockRenewTime: 30000,
  drainDelay: 10, // Fast
  limiter: {
    max: 20,
    duration: 1000,
  },
})
```

---

## Phase 2: Connection Pooling (1-2 hours)

### Step 2: Add Connection Pooling to Workers

#### File: `pdf-notes-optimized.worker.ts`

**Add import:**
```typescript
import { ConnectionPoolUtil } from '../utils/connection-pool.util';
```

**Update constructor:**
```typescript
// Remove individual Supabase client creation
// Replace this:
private readonly supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
private readonly supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY')!;

// With this:
private readonly supabase: SupabaseClient;

constructor(/* ... */) {
  super();
  
  // Use pooled connection
  const supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
  const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY')!;
  this.supabase = ConnectionPoolUtil.getSupabaseClient(supabaseUrl, supabaseKey);
}
```

**Update download logic in `process()` method:**
```typescript
// Replace individual downloads with pooled connection:
// OLD:
const { data, error } = await createClient(url, key)
  .storage.from(bucket).download(path);

// NEW:
const { data, error } = await this.supabase
  .storage.from(bucketName).download(filePath);
```

#### File: `pdf-extract.worker.ts`

**Add optimized download:**
```typescript
import { ConnectionPoolUtil } from '../utils/connection-pool.util';

// In process() method, replace:
const response = await fetch(fileUrl);
const buffer = Buffer.from(await response.arrayBuffer());

// With:
const buffer = await ConnectionPoolUtil.downloadFile(fileUrl, {
  timeout: 120000,
  maxRetries: 3,
  onProgress: (downloaded, total) => {
    const progress = Math.round((downloaded / total) * 100);
    this.logger.debug(`Download progress: ${progress}%`);
  },
});
```

---

## Phase 3: Enhanced Caching (1-2 hours)

### Step 3: Upgrade to Multi-Level Cache

#### File: `pdf-notes-optimized.worker.ts`

**Add imports:**
```typescript
import { RedisOptimizationUtil } from '../utils/redis-optimization.util';
```

**Update constructor:**
```typescript
private readonly multiLevelCache;

constructor(/* ... */) {
  super();
  
  // Create multi-level cache
  this.multiLevelCache = RedisOptimizationUtil.createMultiLevelCache({
    redis: this.redis,
    l1MaxSize: 100,
    l1Ttl: 60000, // 1 minute
    l2Ttl: 86400, // 24 hours
  });
}
```

**Update cache operations in `process()` method:**
```typescript
// Replace PdfCacheUtil.getCachedNotes with:
const pdfHash = PdfCacheUtil.hashPDF(pdfBuffer);
const cachedNotes = await this.multiLevelCache.get(pdfHash);

// Replace PdfCacheUtil.cacheNotes with:
await this.multiLevelCache.set(pdfHash, {
  noteId: generatedNotes.noteId,
  title: generatedNotes.title,
  content: generatedNotes.content,
  summary: generatedNotes.summary,
});
```

---

## Phase 4: Parallel Operations (30 minutes - 1 hour)

### Step 4: Parallelize Independent Operations

#### File: `pdf-notes-optimized.worker.ts`

**Identify sequential operations that can be parallelized:**

```typescript
// BEFORE (Sequential - Slow):
await this.notesService.create(noteData);
await this.cache.set(cacheKey, noteData);
await PdfCacheUtil.clearJob(this.redis, fileId);

// AFTER (Parallel - Fast):
await Promise.all([
  this.notesService.create(noteData),
  this.cache.set(cacheKey, noteData),
  PdfCacheUtil.clearJob(this.redis, fileId),
]);
```

**Another example - check cache while downloading:**
```typescript
// BEFORE:
const pdfBuffer = await downloadPdf();
const cached = await checkCache(pdfBuffer);

// AFTER:
const [pdfBuffer, metadata] = await Promise.all([
  downloadPdf(),
  fetchMetadata(), // Run in parallel if independent
]);
const cached = await checkCache(pdfBuffer);
```

---

## Phase 5: Performance Monitoring (1 hour)

### Step 5: Add Performance Tracking

#### File: `pdf-notes-optimized.worker.ts`

**Add import:**
```typescript
import { WorkerPerformanceUtil } from '../utils/worker-performance.util';
```

**Add to constructor:**
```typescript
private readonly metricsCollector;

constructor(/* ... */) {
  super();
  
  this.metricsCollector = WorkerPerformanceUtil.createMetricsCollector(
    'PdfNotesOptimizedWorker'
  );
}
```

**Add timing in `process()` method:**
```typescript
async process(job: Job): Promise<PdfNotesJobResult> {
  const startTime = Date.now();
  const timer = WorkerPerformanceUtil.createTimer();

  try {
    // Your processing logic...
    
    const duration = timer.end('Job processing');
    this.metricsCollector.recordSuccess(duration);
    
    return result;
  } catch (error) {
    this.metricsCollector.recordFailure();
    throw error;
  }
}

@OnWorkerEvent('completed')
onCompleted(job: Job) {
  this.logger.log(`Job ${job.id} completed`);
  this.metricsCollector.logMetrics(); // Log every 10 jobs or so
}
```

**Add detailed timing for each stage:**
```typescript
const metrics = {
  downloadMs: 0,
  extractMs: 0,
  aiMs: 0,
  saveMs: 0,
};

// Download stage
const downloadTimer = WorkerPerformanceUtil.createTimer();
const buffer = await downloadFile();
metrics.downloadMs = downloadTimer.end('Download');

// Extract stage
const extractTimer = WorkerPerformanceUtil.createTimer();
const text = await extractText(buffer);
metrics.extractMs = extractTimer.end('Extract');

// AI stage
const aiTimer = WorkerPerformanceUtil.createTimer();
const notes = await generateNotes(text);
metrics.aiMs = aiTimer.end('AI');

// Save stage
const saveTimer = WorkerPerformanceUtil.createTimer();
await saveNotes(notes);
metrics.saveMs = saveTimer.end('Save');

// Log breakdown
this.logger.log(
  `Job ${job.id} breakdown: ` +
  `download=${metrics.downloadMs}ms, ` +
  `extract=${metrics.extractMs}ms, ` +
  `ai=${metrics.aiMs}ms, ` +
  `save=${metrics.saveMs}ms`
);
```

---

## Phase 6: Circuit Breakers (30 minutes)

### Step 6: Add Circuit Breakers for External Services

#### File: `ai-notes.worker.ts`

**Wrap AI calls with circuit breaker:**

```typescript
import { WorkerPerformanceUtil } from '../utils/worker-performance.util';

// In constructor, create circuit breaker
private aiWithCircuitBreaker;

constructor(/* ... */) {
  super();
  
  this.aiWithCircuitBreaker = WorkerPerformanceUtil.createCircuitBreaker(
    async (text: string, fileName: string, userId: string, fileId: string) => {
      return await this.aiService.generateStructuredNotes(
        text,
        fileName,
        userId,
        fileId,
      );
    },
    {
      threshold: 5,
      timeout: 30000,
      resetTimeout: 60000,
    },
  );
}

// In process() method, replace:
const notes = await this.aiService.generateStructuredNotes(...);

// With:
const notes = await this.aiWithCircuitBreaker(
  extractedText,
  fileName,
  userId,
  fileId,
);
```

---

## Phase 7: Batch Operations (1 hour)

### Step 7: Optimize Database Batch Operations

#### File: `jobs.service.ts`

**Add batch update method:**

```typescript
import { BatchProcessingUtil } from './utils/batch-processing.util';

/**
 * Batch update job statuses
 */
async batchUpdateJobStatus(
  updates: Array<{
    jobId: string;
    status: JobStatus;
    progress?: number;
  }>,
): Promise<void> {
  await BatchProcessingUtil.processBatch(
    updates,
    async (update) => {
      return await this.databaseService.job.update({
        where: { jobId: update.jobId },
        data: {
          status: update.status,
          progress: update.progress,
          updatedAt: new Date(),
        },
      });
    },
    {
      batchSize: 20,
      concurrency: 5,
    },
  );
}
```

---

## Phase 8: Queue Monitoring Setup (1 hour)

### Step 8: Add Queue Monitoring

#### File: `jobs.module.ts`

**Add monitoring service:**

```typescript
import { QueueMonitoringService } from './services/queue-monitoring.service';

@Module({
  // ... existing config
  providers: [
    // ... existing providers
    QueueMonitoringService,
  ],
  exports: [
    // ... existing exports
    QueueMonitoringService,
  ],
})
export class JobsModule implements OnModuleInit {
  constructor(
    private readonly monitoringService: QueueMonitoringService,
    @InjectQueue('pdf-notes-optimized') private pdfNotesQueue: Queue,
    @InjectQueue('ai-notes') private aiNotesQueue: Queue,
    @InjectQueue('pdf-extract') private pdfExtractQueue: Queue,
    @InjectQueue('completion') private completionQueue: Queue,
  ) {}

  onModuleInit() {
    // Register all queues for monitoring
    this.monitoringService.registerQueue('pdf-notes-optimized', this.pdfNotesQueue);
    this.monitoringService.registerQueue('ai-notes', this.aiNotesQueue);
    this.monitoringService.registerQueue('pdf-extract', this.pdfExtractQueue);
    this.monitoringService.registerQueue('completion', this.completionQueue);
    
    // Start health checks
    this.monitoringService.startHealthChecks(30000);
  }
}
```

#### File: `jobs.controller.ts`

**Add monitoring endpoints:**

```typescript
import { QueueMonitoringService } from './services/queue-monitoring.service';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly monitoringService: QueueMonitoringService,
  ) {}

  /**
   * Get performance report
   * GET /jobs/monitoring/report
   */
  @Get('monitoring/report')
  async getPerformanceReport() {
    return this.monitoringService.getPerformanceReport();
  }

  /**
   * Get detailed queue stats
   * GET /jobs/monitoring/:queueName
   */
  @Get('monitoring/:queueName')
  async getQueueStats(@Param('queueName') queueName: string) {
    const queue = this.getQueueByName(queueName);
    return this.monitoringService.getDetailedStats(queue);
  }
}
```

---

## Testing Your Optimizations

### Before and After Benchmarking

```bash
# 1. Test BEFORE optimizations
cd k6-tests
./run-test.ps1 upload-test.js

# Note the metrics:
# - Average processing time
# - 95th percentile
# - Throughput (jobs/min)

# 2. Apply optimizations (Phases 1-8)

# 3. Test AFTER optimizations
./run-test.ps1 upload-test.js

# Compare improvements!
```

### Expected Results

| Metric | Before | After | Improvement |
|--------|---------|-------|-------------|
| Avg Processing Time | 35s | 6s | **5.8x faster** |
| P95 Processing Time | 50s | 10s | **5x faster** |
| Throughput | 5 jobs/min | 25 jobs/min | **5x higher** |
| Cache Hit Rate | 0% | 85% | **Instant for duplicates** |
| Failed Jobs | 8% | 2% | **4x fewer failures** |

---

## Rollback Plan

If something breaks:

1. **Revert worker configs** - Change back to original concurrency/drainDelay
2. **Remove connection pooling** - Use direct connections
3. **Disable multi-level cache** - Fall back to Redis-only cache
4. **Disable circuit breakers** - Remove wrapping logic
5. **Check logs** - Look for errors in worker execution

---

## Monitoring in Production

### Key Metrics to Watch

```typescript
// Get queue health
const report = await monitoringService.getPerformanceReport();

console.log(`
  Total Jobs Processed: ${report.totalJobsProcessed}
  Total Jobs Failed: ${report.totalJobsFailed}
  Failure Rate: ${(report.totalJobsFailed / report.totalJobsProcessed * 100).toFixed(1)}%
  Avg Throughput: ${report.avgThroughput.toFixed(1)} jobs/min
  Healthy Queues: ${report.healthyQueues}/${report.totalQueues}
`);
```

### Alerts to Configure

1. **High failure rate** (>10%)
2. **Low throughput** (<5 jobs/min)
3. **Queue backup** (>100 waiting jobs)
4. **Slow processing** (avg >30s)

---

## Next Steps

1. ✅ Complete Phases 1-3 (Quick wins)
2. ✅ Test with k6 to measure improvement
3. ✅ Complete Phases 4-6 (Advanced optimizations)
4. ✅ Set up monitoring (Phases 7-8)
5. ✅ Monitor for 1 week
6. ✅ Adjust concurrency based on metrics
7. ✅ Fine-tune cache TTLs
8. ✅ Document learnings

---

## Support

- **Example Worker:** `ultra-optimized-pdf.worker.ts`
- **Main Guide:** `WORKER_OPTIMIZATION_GUIDE.md`
- **Utilities:** `backend/src/jobs/utils/`
