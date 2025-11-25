# 🚀 Backend Pipeline Performance Optimization Plan

**Target**: Reduce PDF → Notes processing from **30-50s** to **5-10s** (83% faster)

---

## 📊 Current Bottlenecks Analysis

### Current Pipeline (30-50s for 500KB PDF):
```
Upload → Queue → Worker Downloads (5-8s) → Full LLM Call (20-35s) → DB Save (1-2s) → WebSocket Update
```

**Problems:**
1. **Sequential I/O**: Download blocks LLM call
2. **Single LLM Request**: Large PDFs = slow response (20-35s)
3. **No Caching**: Same PDF reprocessed every time
4. **No Deduplication**: Multiple uploads = multiple jobs
5. **Inefficient Prompt**: Verbose → more tokens → slower
6. **Underutilized Resources**: 1 job/worker, no parallelism

---

## 🎯 Optimized Architecture

### New Pipeline (5-10s target):
```
Upload → 
  ├─ Hash Check (cache hit = instant) → Return cached notes
  └─ Cache Miss →
      ├─ Stream PDF + Extract Text (2-3s parallel)
      ├─ Chunk Text (3-5 chunks)
      ├─ Parallel LLM Calls (3-5s concurrent)
      ├─ Merge Results (0.5s)
      ├─ DB Write (async, non-blocking)
      └─ Progressive WebSocket Updates
```

---

## 🔧 Implementation Strategy

### Phase 1: Immediate Wins (Hours)
1. **PDF Caching by Hash** - Instant for duplicate PDFs
2. **Optimized Prompt** - Reduce tokens by 70%
3. **Parallel LLM Processing** - 3-5 concurrent chunks
4. **Streaming PDF Download** - Start processing before full download
5. **Progressive WebSocket** - Show chunks as they arrive

### Phase 2: Architecture Improvements (Days)
1. **Job Deduplication** - Same PDF = single job, multiple subscribers
2. **Redis Result Caching** - Cache notes for 24h
3. **Database Write Batching** - Async, non-blocking
4. **Worker Scaling** - Increase concurrency from 2 to 5-10
5. **Connection Pooling** - Optimize Prisma/Redis/Supabase

### Phase 3: Advanced Optimizations (Week)
1. **PDF Text Extraction First** - Use pdf-parse before LLM
2. **Semantic Chunking** - Smart splitting at paragraph boundaries
3. **LLM Batch API** - Use Gemini batch endpoints
4. **CDN for PDFs** - Reduce Supabase latency
5. **Horizontal Scaling** - Multiple worker instances

---

## 💻 Technical Implementation

### 1. PDF Content Hashing & Caching
```typescript
// Cache key: SHA256 of PDF content
const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
const cached = await redis.get(`pdf:notes:${pdfHash}`);
if (cached) return JSON.parse(cached); // INSTANT RETURN
```

### 2. Optimized AI Prompt (70% token reduction)
```typescript
// OLD: 350 tokens → NEW: 100 tokens
const prompt = `Extract study notes from this PDF. Format:
# Title
## Overview: [1 sentence]
## Key Points:
- Point 1
- Point 2
## Terms:
- Term: Definition
## Summary: [2 sentences]
Output ONLY the notes.`;
```

### 3. Parallel Chunk Processing
```typescript
// Split text into 3-5 chunks
const chunks = semanticChunk(text, 4000);

// Process ALL chunks concurrently
const results = await Promise.all(
  chunks.map(chunk => 
    this.model.generateContent(createChunkPrompt(chunk))
  )
);

// Merge intelligently
const merged = mergeChunkedNotes(results);
```

### 4. Streaming PDF + Progressive Processing
```typescript
// Start processing before full download
const stream = supabase.storage.from('pdfs').createDownloadStream(path);
let buffer = Buffer.alloc(0);

stream.on('data', async (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  
  // Process if we have enough data
  if (buffer.length >= MIN_CHUNK_SIZE) {
    await processChunk(buffer);
    buffer = Buffer.alloc(0);
  }
});
```

### 5. Job Deduplication
```typescript
// Before queuing new job
const existingJobId = await redis.get(`pdf:job:${fileId}`);
if (existingJobId) {
  // Subscribe to existing job's updates
  return { jobId: existingJobId, message: 'Joined existing job' };
}

// Set job ID with TTL
await redis.setex(`pdf:job:${fileId}`, 300, newJobId);
```

### 6. Progressive WebSocket Updates
```typescript
// Send updates as chunks complete
for (let i = 0; i < chunks.length; i++) {
  const chunkResult = await processChunk(chunks[i]);
  
  wsGateway.emit('chunk-complete', {
    jobId,
    chunkIndex: i,
    totalChunks: chunks.length,
    preview: chunkResult.substring(0, 200),
    progress: ((i + 1) / chunks.length) * 100
  });
}
```

---

## ⚙️ Configuration Optimizations

### BullMQ Worker Settings
```typescript
@Processor('pdf-notes-fast', {
  concurrency: 10,        // OLD: 2 → NEW: 10
  stalledInterval: 120000, // Reduce checks
  drainDelay: 30,         // Faster polling when active
  limiter: {
    max: 20,              // 20 jobs per second
    duration: 1000
  }
})
```

### Redis Connection Pooling
```typescript
connection: {
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: false,
  lazyConnect: false,
  keepAlive: 30000,
  family: 6,
  // Connection pooling
  connectionPool: {
    min: 5,
    max: 20
  }
}
```

### Prisma Connection Pooling
```typescript
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Optimize connection pool
  connection_limit = 20
  pool_timeout = 10
}
```

### Supabase Storage Optimization
```typescript
// Use CDN for faster downloads
const cdnUrl = `${supabaseUrl}/storage/v1/object/public/pdfs/${filePath}`;

// Enable HTTP/2 for multiplexing
const response = await fetch(cdnUrl, {
  headers: {
    'Accept-Encoding': 'gzip, deflate, br'
  }
});
```

---

## 📈 Performance Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| **Total Time** | 30-50s | 5-10s | **83% faster** |
| **PDF Download** | 5-8s | 1-2s (stream) | 75% faster |
| **LLM Processing** | 20-35s | 3-5s (parallel) | 85% faster |
| **DB Write** | 1-2s | <0.5s (async) | 75% faster |
| **Cache Hit** | N/A | <100ms | Instant |

---

## 🔥 "FAST MODE" Pipeline

```typescript
// 1. Immediate: Check cache by PDF hash
const hash = hashPDF(buffer);
const cached = await redis.get(`notes:${hash}`);
if (cached) return cached; // < 100ms

// 2. Extract text FIRST (faster than LLM reading PDF)
const { text } = await pdfParse(buffer); // 1-2s

// 3. Smart chunking by paragraphs
const chunks = semanticChunk(text, 4000); // 3-5 chunks

// 4. Process ALL chunks in parallel
const promises = chunks.map((chunk, i) => 
  this.model.generateContent(optimizedPrompt(chunk))
    .then(result => {
      // Progressive update
      wsGateway.emit('chunk-done', { i, preview: result.text().substring(0,100) });
      return result;
    })
);

// 5. Wait for all (3-5s total, not sequential)
const results = await Promise.all(promises);

// 6. Intelligent merge
const merged = mergeNotes(results); // 0.5s

// 7. Save async (don't block response)
this.saveNotes(userId, merged).catch(err => logger.error(err));

// 8. Cache result
await redis.setex(`notes:${hash}`, 86400, JSON.stringify(merged));

// 9. Return immediately
return merged;
```

**Expected Timeline:**
- PDF already uploaded: 0s (parallel during upload)
- Text extraction: 1-2s
- Parallel LLM (3 chunks): 3-5s concurrent
- Merge: 0.5s
- **Total: 4.5-7.5s** ✅

---

## 🏗️ Infrastructure Recommendations

### Immediate (No Cost)
1. ✅ Increase worker concurrency to 10
2. ✅ Enable Redis pipelining
3. ✅ Use Prisma connection pooling
4. ✅ Optimize prompts (70% token reduction)

### Short-term (Low Cost)
1. 🔧 Deploy 2-3 worker instances
2. 🔧 Use Upstash Redis Pro (faster)
3. 🔧 Enable Supabase CDN
4. 🔧 Upgrade to Gemini Pro (faster, batch API)

### Long-term (Scalable)
1. 🚀 Kubernetes for auto-scaling workers
2. 🚀 Dedicated GPU instance for OCR
3. 🚀 CloudFront CDN for PDFs
4. 🚀 Read replicas for Postgres

---

## 🎯 Action Plan

### Week 1: Quick Wins
- [ ] Implement PDF hashing & Redis caching
- [ ] Optimize AI prompt (reduce tokens)
- [ ] Implement parallel chunk processing
- [ ] Add progressive WebSocket updates

### Week 2: Architecture
- [ ] Job deduplication logic
- [ ] Streaming PDF downloads
- [ ] Semantic text chunking
- [ ] Database write batching

### Week 3: Scaling
- [ ] Increase worker concurrency
- [ ] Connection pool optimization
- [ ] Horizontal scaling setup
- [ ] Performance monitoring

### Week 4: Polish
- [ ] LLM batch API integration
- [ ] Advanced caching strategies
- [ ] Rate limiting & backpressure
- [ ] Load testing & tuning

---

## 📊 Monitoring & Metrics

```typescript
// Track these metrics
metrics.timing('pdf.download', downloadTime);
metrics.timing('llm.chunk', chunkTime);
metrics.timing('llm.total', totalLLMTime);
metrics.timing('db.write', dbWriteTime);
metrics.timing('pipeline.total', totalTime);
metrics.increment('cache.hit');
metrics.increment('cache.miss');
```

---

## 🔬 Testing Strategy

### Load Testing
```bash
# Simulate 50 concurrent uploads
artillery quick --count 50 --num 10 http://localhost:3000/upload
```

### Benchmark Targets
- p50: < 6s
- p95: < 10s  
- p99: < 15s
- Cache hit: < 100ms

---

**Expected Results:**
- 83% reduction in total processing time
- 10x faster for duplicate PDFs (cache hits)
- 5x better throughput (parallel processing)
- Better user experience (progressive updates)
