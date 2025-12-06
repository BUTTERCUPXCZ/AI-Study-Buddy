# Worker Optimization Quick Reference

## 🚀 Quick Commands

```bash
# Test performance
cd k6-tests
./run-test.ps1 upload-test.js

# Check queue health
curl http://localhost:3000/jobs/monitoring/report

# View metrics
curl http://localhost:3000/jobs/monitoring/pdf-notes-optimized
```

---

## 🎯 Optimal Worker Settings

### I/O-Bound (PDF, Downloads, API Calls)
```typescript
concurrency: 20
drainDelay: 10
limiter: { max: 30, duration: 1000 }
```

### CPU-Bound (Text Processing, Quiz Gen)
```typescript
concurrency: 5
drainDelay: 20
limiter: { max: 10, duration: 1000 }
```

### Mixed (Download + Process)
```typescript
concurrency: 12
drainDelay: 15
limiter: { max: 20, duration: 1000 }
```

---

## 💡 Code Snippets

### Connection Pooling
```typescript
import { ConnectionPoolUtil } from '../utils/connection-pool.util';

// Reuse Supabase connection
this.supabase = ConnectionPoolUtil.getSupabaseClient(url, key);

// Optimized downloads
const buffer = await ConnectionPoolUtil.downloadFile(fileUrl);
```

### Multi-Level Cache
```typescript
import { RedisOptimizationUtil } from '../utils/redis-optimization.util';

const cache = RedisOptimizationUtil.createMultiLevelCache({
  redis: this.redis,
  l1MaxSize: 100,
  l1Ttl: 60000,
  l2Ttl: 86400,
});

const cached = await cache.get(key);
if (cached) return cached;

const result = await process();
await cache.set(key, result);
```

### Parallel Operations
```typescript
// Sequential (slow)
await operation1();
await operation2();
await operation3();

// Parallel (fast)
await Promise.all([
  operation1(),
  operation2(),
  operation3(),
]);
```

### Performance Tracking
```typescript
import { WorkerPerformanceUtil } from '../utils/worker-performance.util';

const timer = WorkerPerformanceUtil.createTimer();
const result = await process();
const duration = timer.end('Operation');
console.log(`Took ${duration}ms`);
```

### Circuit Breaker
```typescript
const withBreaker = WorkerPerformanceUtil.createCircuitBreaker(
  async () => await externalService.call(),
  { threshold: 5, timeout: 30000, resetTimeout: 60000 }
);

const result = await withBreaker();
```

### Batch Processing
```typescript
import { BatchProcessingUtil } from '../utils/batch-processing.util';

await BatchProcessingUtil.processBatch(
  items,
  async (item) => process(item),
  { batchSize: 20, concurrency: 5 }
);
```

### Redis Pipeline
```typescript
import { RedisOptimizationUtil } from '../utils/redis-optimization.util';

await RedisOptimizationUtil.batchSet(redis, [
  { key: 'key1', value: 'val1', ttl: 3600 },
  { key: 'key2', value: 'val2', ttl: 3600 },
]);
```

---

## 📊 Performance Targets

| Worker | Target Time | Max Concurrency | Cache Hit Rate |
|--------|-------------|-----------------|----------------|
| PDF Notes | <8s | 20 | >80% |
| AI Notes | <15s | 5 | N/A |
| PDF Extract | <5s | 8 | N/A |
| Completion | <1s | 10 | N/A |

---

## 🔍 Debugging Checklist

- [ ] Check worker concurrency settings
- [ ] Verify connection pooling is active
- [ ] Check cache hit rates
- [ ] Monitor Redis connection count
- [ ] Review queue metrics
- [ ] Check for stalled jobs
- [ ] Review error logs
- [ ] Test with single job first
- [ ] Monitor memory usage
- [ ] Check network latency

---

## ⚠️ Common Issues & Fixes

### High Memory Usage
```typescript
// Reduce concurrency
concurrency: 10 → 5

// Add memory monitoring
const memUsed = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(`Memory: ${memUsed.toFixed(2)}MB`);
```

### Slow Processing
```typescript
// Add timing
const timer = WorkerPerformanceUtil.createTimer();
// ... operations ...
console.log(`Stage 1: ${timer.end()}ms`);
```

### High Failure Rate
```typescript
// Add circuit breaker
const withBreaker = WorkerPerformanceUtil.createCircuitBreaker(
  operation,
  { threshold: 5, timeout: 30000 }
);
```

### Queue Backup
```typescript
// Increase concurrency
concurrency: 5 → 10

// Check for bottlenecks
const stats = await queue.getJobCounts();
console.log(stats);
```

---

## 🎪 Load Testing

```bash
# Baseline test
k6 run upload-test.js

# Stress test
k6 run stress-test.js

# Soak test (30 min)
k6 run soak-test.js
```

---

## 📈 Monitoring Queries

```typescript
// Queue health
const report = await monitoringService.getPerformanceReport();

// Detailed stats
const stats = await monitoringService.getDetailedStats(queue);

// Metrics for specific queue
const metrics = monitoringService.getQueueMetrics('pdf-notes');
```

---

## 🛠️ Utility Functions

```typescript
// Calculate optimal concurrency
const optimal = WorkerPerformanceUtil.calculateOptimalConcurrency();
console.log(`Recommended: ${optimal.recommended}`);

// Smart text chunking
const chunks = WorkerPerformanceUtil.smartChunk(text, 8000, 200);

// Retry with backoff
const result = await WorkerPerformanceUtil.retryWithBackoff(
  operation,
  3,
  1000
);

// Memory tracking
const result = await WorkerPerformanceUtil.trackMemory(
  async () => await heavyOperation(),
  'Heavy operation'
);
```

---

## 📚 File Reference

| File | Purpose |
|------|---------|
| `worker-performance.util.ts` | Timing, metrics, retry logic |
| `connection-pool.util.ts` | HTTP/Supabase pooling |
| `redis-optimization.util.ts` | Cache, pipelines, batching |
| `batch-processing.util.ts` | Parallel/batch operations |
| `queue-monitoring.service.ts` | Queue health monitoring |
| `ultra-optimized-pdf.worker.ts` | Reference implementation |

---

## 🎓 Best Practices

1. ✅ Always check cache before processing
2. ✅ Reuse connections via pooling
3. ✅ Run independent operations in parallel
4. ✅ Use circuit breakers for external services
5. ✅ Track performance metrics
6. ✅ Implement proper error handling
7. ✅ Use batch operations for multiple items
8. ✅ Monitor queue health
9. ✅ Set appropriate concurrency levels
10. ✅ Test with realistic load

---

## 🚨 Emergency Commands

```bash
# Pause all queues
curl -X POST http://localhost:3000/jobs/queue/pdf-notes/pause

# Clear failed jobs
curl -X DELETE http://localhost:3000/jobs/cleanup?days=1

# Check active jobs
curl http://localhost:3000/jobs/queue/pdf-notes/active

# Get job details
curl http://localhost:3000/jobs/:jobId
```

---

## 📞 Need Help?

1. Check `WORKER_OPTIMIZATION_GUIDE.md` for detailed explanations
2. Review `WORKER_OPTIMIZATION_ROADMAP.md` for implementation steps
3. Examine `ultra-optimized-pdf.worker.ts` for working example
4. Use monitoring endpoint: `/jobs/monitoring/report`

---

**Last Updated:** December 6, 2025
