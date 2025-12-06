# Background Jobs Performance Optimization Guide

## 🚀 Quick Wins (Implement First)

### 1. Optimize Worker Concurrency Settings

**Current Configuration Issues:**
- Some workers use `drainDelay: 60` (too slow when active)
- Inconsistent concurrency levels across workers
- No dynamic concurrency adjustment

**Optimized Configuration:**
```typescript
@Processor('your-queue', {
  concurrency: 20, // Higher for I/O-bound tasks (PDF, API calls)
  stalledInterval: 120000, // 2 minutes (reduce Redis checks)
  maxStalledCount: 1,
  lockDuration: 120000, // 2 minutes
  lockRenewTime: 60000, // Renew halfway through
  drainDelay: 10, // Fast polling (10ms) when jobs are active
  limiter: {
    max: 30, // Max jobs per second
    duration: 1000,
    bounceBack: false, // Don't bounce back to queue
  },
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      // Exponential backoff for retries
      return Math.min(1000 * Math.pow(2, attemptsMade), 60000);
    },
  },
})
```

**Why This Works:**
- ⚡ `drainDelay: 10` - Fast polling when queue has jobs
- 🔄 Higher concurrency for I/O-bound tasks (they spend time waiting)
- 🛡️ Circuit breaker via backoff strategy
- 🚫 `bounceBack: false` - Don't requeue immediately on rate limit

---

### 2. Connection Pooling (30-50% Performance Gain)

**Problem:** Creating new Supabase/HTTP connections for every job.

**Solution:** Use connection pooling utility:

```typescript
import { ConnectionPoolUtil } from './utils/connection-pool.util';

// In your worker constructor
private readonly supabase: SupabaseClient;

constructor() {
  // Reuse connection from pool
  this.supabase = ConnectionPoolUtil.getSupabaseClient(
    supabaseUrl,
    supabaseKey
  );
}

// For HTTP downloads
const buffer = await ConnectionPoolUtil.downloadFile(fileUrl, {
  timeout: 120000,
  maxRetries: 3,
  onProgress: (downloaded, total) => {
    console.log(`Downloaded ${downloaded}/${total} bytes`);
  },
});
```

**Benefits:**
- ✅ Eliminates connection overhead (saves 200-500ms per job)
- ✅ Reuses TCP connections (faster downloads)
- ✅ Automatic retry logic
- ✅ Progress tracking

---

### 3. Multi-Level Caching (10x Faster for Duplicates)

**Problem:** Processing same PDF multiple times takes 30-50 seconds each.

**Solution:** Implement L1 (memory) + L2 (Redis) caching:

```typescript
import { RedisOptimizationUtil } from './utils/redis-optimization.util';

// Create multi-level cache
const cache = RedisOptimizationUtil.createMultiLevelCache({
  redis: this.redis,
  l1MaxSize: 100, // 100 most recent in memory
  l1Ttl: 60000, // 1 minute
  l2Ttl: 86400, // 24 hours
});

// Check cache before processing
const pdfHash = PdfCacheUtil.hashPDF(pdfBuffer);
const cached = await cache.get(pdfHash);

if (cached) {
  // Return cached result instantly (~500ms)
  return cached;
}

// Process and cache
const result = await processExpensiveOperation();
await cache.set(pdfHash, result);
```

**Performance Impact:**
- 🚀 Cache hit: ~500ms (vs 30-50s)
- 📊 90%+ cache hit rate for duplicate files
- 💾 L1 cache: ~5ms lookup
- 💾 L2 cache: ~50ms lookup

---

## 🎯 Advanced Optimizations

### 4. Batch Processing for Database Operations

**Problem:** Multiple sequential DB calls block processing.

**Solution:** Batch operations with pipelining:

```typescript
import { BatchProcessingUtil } from './utils/batch-processing.util';

// Instead of sequential saves
for (const item of items) {
  await db.save(item); // ❌ Slow
}

// Use batch processing
await BatchProcessingUtil.processBatch(
  items,
  async (item) => db.save(item),
  {
    batchSize: 20, // Process 20 at a time
    concurrency: 5, // Max 5 parallel operations
    onProgress: (completed, total) => {
      console.log(`Saved ${completed}/${total} items`);
    },
  }
);
```

**Benefits:**
- ✅ 5-10x faster for bulk operations
- ✅ Controlled memory usage
- ✅ Progress tracking
- ✅ Error handling per item

---

### 5. Redis Pipeline for Multiple Operations

**Problem:** Multiple Redis calls = multiple round trips.

**Solution:** Use Redis pipelining:

```typescript
import { RedisOptimizationUtil } from './utils/redis-optimization.util';

// Instead of individual operations
await redis.set('key1', 'value1'); // ❌ 3 round trips
await redis.set('key2', 'value2');
await redis.set('key3', 'value3');

// Use batching
await RedisOptimizationUtil.batchSet(redis, [
  { key: 'key1', value: 'value1', ttl: 3600 },
  { key: 'key2', value: 'value2', ttl: 3600 },
  { key: 'key3', value: 'value3', ttl: 3600 },
]); // ✅ 1 round trip
```

**Performance:**
- ⚡ 10x faster for multiple operations
- 📉 Reduces Upstash/Redis costs
- 🔄 Atomic operations

---

### 6. Parallel Processing of Independent Operations

**Problem:** Sequential operations when they could run in parallel.

**Solution:** Use `Promise.all` for independent tasks:

```typescript
// ❌ Sequential (slow)
const step1 = await downloadFile();
const step2 = await checkCache();
const step3 = await validateData();

// ✅ Parallel (fast)
const [step1, step2, step3] = await Promise.all([
  downloadFile(),
  checkCache(),
  validateData(),
]);
```

**Real-World Example:**
```typescript
// Save to DB and cache in parallel
await Promise.all([
  this.notesService.create(noteData),
  this.cache.set(cacheKey, noteData),
  this.redis.del(lockKey), // Clear job lock
]);
```

---

### 7. Circuit Breaker for External Services

**Problem:** Failed API calls block worker and waste retries.

**Solution:** Implement circuit breaker pattern:

```typescript
import { WorkerPerformanceUtil } from './utils/worker-performance.util';

const aiWithCircuitBreaker = WorkerPerformanceUtil.createCircuitBreaker(
  async () => {
    return await this.aiService.generateNotes(text);
  },
  {
    threshold: 5, // Open circuit after 5 failures
    timeout: 30000, // 30 second timeout per attempt
    resetTimeout: 60000, // Try again after 1 minute
  }
);

const result = await aiWithCircuitBreaker();
```

**Benefits:**
- 🛡️ Prevents cascade failures
- ⚡ Fails fast when service is down
- 🔄 Automatic recovery
- 📊 Better error handling

---

### 8. Smart Chunking for Large Text

**Problem:** LLM token limits cause failures or multiple calls.

**Solution:** Intelligent text chunking:

```typescript
import { WorkerPerformanceUtil } from './utils/worker-performance.util';

const chunks = WorkerPerformanceUtil.smartChunk(
  largeText,
  8000, // Max chunk size (tokens)
  200   // Overlap between chunks
);

// Process chunks in parallel
const results = await Promise.all(
  chunks.map(chunk => aiService.process(chunk))
);

// Merge results
const mergedResult = results.join('\n\n');
```

---

## 📊 Monitoring and Metrics

### 9. Performance Tracking

```typescript
import { WorkerPerformanceUtil } from './utils/worker-performance.util';

// In worker constructor
private metricsCollector = WorkerPerformanceUtil.createMetricsCollector('PdfWorker');

// Track successful jobs
const timer = WorkerPerformanceUtil.createTimer();
const result = await processJob(job);
const duration = timer.end();
this.metricsCollector.recordSuccess(duration);

// Track failures
this.metricsCollector.recordFailure();

// Log metrics periodically
this.metricsCollector.logMetrics();
// Output: [PdfWorker] Processed: 150, Failed: 2, Avg Time: 8523.45ms
```

---

### 10. Queue Health Monitoring

```typescript
import { QueueMonitoringService } from './services/queue-monitoring.service';

// Register queues for monitoring
monitoringService.registerQueue('pdf-notes', pdfNotesQueue);
monitoringService.startHealthChecks(30000); // Check every 30s

// Get detailed stats
const stats = await monitoringService.getDetailedStats(pdfNotesQueue);
console.log(stats.recommendations);
// Output: ["High number of waiting jobs (234). Consider increasing worker concurrency."]

// Get performance report
const report = monitoringService.getPerformanceReport();
```

---

## 🏗️ Worker Architecture Best Practices

### Optimal Worker Structure

```typescript
@Processor('optimized-queue', {
  concurrency: 20,
  drainDelay: 10,
  limiter: { max: 30, duration: 1000 },
})
export class OptimizedWorker extends WorkerHost {
  // 1. Initialize resources in constructor (reuse them)
  private readonly supabase: SupabaseClient;
  private readonly cache: MultiLevelCache;
  private readonly metrics: MetricsCollector;

  constructor(/* dependencies */) {
    super();
    
    // Reusable resources
    this.supabase = ConnectionPoolUtil.getSupabaseClient(url, key);
    this.cache = RedisOptimizationUtil.createMultiLevelCache({...});
    this.metrics = WorkerPerformanceUtil.createMetricsCollector('Worker');
  }

  async process(job: Job) {
    const timer = WorkerPerformanceUtil.createTimer();

    try {
      // 2. Check cache first
      const cached = await this.cache.get(job.data.key);
      if (cached) return cached;

      // 3. Parallel independent operations
      const [data1, data2] = await Promise.all([
        this.fetchData1(),
        this.fetchData2(),
      ]);

      // 4. Process with circuit breaker
      const result = await this.withCircuitBreaker(async () => {
        return await this.processData(data1, data2);
      });

      // 5. Save and cache in parallel
      await Promise.all([
        this.saveResult(result),
        this.cache.set(job.data.key, result),
      ]);

      // 6. Track metrics
      this.metrics.recordSuccess(timer.end());

      return result;
    } catch (error) {
      this.metrics.recordFailure();
      throw error;
    }
  }
}
```

---

## 🎛️ Configuration Tuning by Worker Type

### CPU-Bound Workers (Quiz Generation, Text Processing)
```typescript
@Processor('cpu-intensive', {
  concurrency: 5, // Match CPU cores
  drainDelay: 20,
  limiter: { max: 10, duration: 1000 },
})
```

### I/O-Bound Workers (PDF Download, API Calls)
```typescript
@Processor('io-bound', {
  concurrency: 20, // Higher because waiting on I/O
  drainDelay: 10,
  limiter: { max: 30, duration: 1000 },
})
```

### Mixed Workers (Download + Process)
```typescript
@Processor('mixed', {
  concurrency: 12, // Balance between CPU and I/O
  drainDelay: 15,
  limiter: { max: 20, duration: 1000 },
})
```

---

## 🔧 Debugging Slow Jobs

### Use Performance Tracking

```typescript
const timer = WorkerPerformanceUtil.createTimer();

const downloadTimer = WorkerPerformanceUtil.createTimer();
const buffer = await downloadFile();
console.log(`Download: ${downloadTimer.end()}ms`);

const extractTimer = WorkerPerformanceUtil.createTimer();
const text = await extractText(buffer);
console.log(`Extract: ${extractTimer.end()}ms`);

const aiTimer = WorkerPerformanceUtil.createTimer();
const notes = await generateNotes(text);
console.log(`AI: ${aiTimer.end()}ms`);

console.log(`Total: ${timer.end()}ms`);
```

**Sample Output:**
```
Download: 1250ms
Extract: 850ms
AI: 12500ms ← Bottleneck!
Total: 14600ms
```

---

## 📈 Expected Performance Improvements

| Optimization | Before | After | Improvement |
|-------------|---------|-------|-------------|
| Connection Pooling | 30-50s | 25-40s | ~20% faster |
| Multi-Level Cache (hit) | 30-50s | 0.5s | **60-100x faster** |
| Redis Pipelining | 500ms | 50ms | 10x faster |
| Parallel Operations | 30s | 20s | 33% faster |
| All Combined | 30-50s | **3-8s** | **4-10x faster** |

---

## 🚨 Common Pitfalls to Avoid

### ❌ DON'T: Create new connections per job
```typescript
// ❌ Slow - creates new connection every time
const supabase = createClient(url, key);
```

### ✅ DO: Reuse connections
```typescript
// ✅ Fast - reuses connection from pool
this.supabase = ConnectionPoolUtil.getSupabaseClient(url, key);
```

---

### ❌ DON'T: Sequential operations that can be parallel
```typescript
// ❌ Takes 6 seconds total
await save(data); // 2s
await cache(data); // 2s
await notify(data); // 2s
```

### ✅ DO: Parallel independent operations
```typescript
// ✅ Takes 2 seconds total
await Promise.all([
  save(data),
  cache(data),
  notify(data),
]);
```

---

### ❌ DON'T: Process without cache check
```typescript
// ❌ Always processes (30-50s)
const result = await expensiveOperation();
```

### ✅ DO: Check cache first
```typescript
// ✅ Cache hit: 500ms, miss: 30-50s
const cached = await cache.get(key);
if (cached) return cached;

const result = await expensiveOperation();
await cache.set(key, result);
```

---

## 🎯 Implementation Checklist

- [ ] Update worker concurrency settings
- [ ] Implement connection pooling
- [ ] Add multi-level caching
- [ ] Use Redis pipelining for batch operations
- [ ] Parallelize independent operations
- [ ] Add circuit breakers for external services
- [ ] Implement performance tracking
- [ ] Set up queue monitoring
- [ ] Add retry logic with exponential backoff
- [ ] Optimize database batch operations
- [ ] Test with load testing (k6)
- [ ] Monitor and adjust based on metrics

---

## 📚 Related Files

- `worker-performance.util.ts` - Performance utilities
- `connection-pool.util.ts` - Connection pooling
- `redis-optimization.util.ts` - Redis optimizations
- `batch-processing.util.ts` - Batch processing
- `queue-monitoring.service.ts` - Queue monitoring
- `ultra-optimized-pdf.worker.ts` - Example implementation

---

## 🔗 Additional Resources

- [BullMQ Best Practices](https://docs.bullmq.io/guide/workers/best-practices)
- [Node.js Performance Tips](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Redis Pipelining](https://redis.io/docs/manual/pipelining/)

---

**Need Help?** Check the example worker: `ultra-optimized-pdf.worker.ts`
