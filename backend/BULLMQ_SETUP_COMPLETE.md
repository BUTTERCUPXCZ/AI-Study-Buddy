# BullMQ PDF Extract Queue - Setup Complete ✅

## What Was Implemented

### 1. **BullMQ Module Structure**
- ✅ Installed `bullmq`, `@nestjs/bullmq`, `ioredis`, and `pdf-parse`
- ✅ Created main `JobsModule` with BullMQ configuration
- ✅ Set up Redis connection using TCP (for Upstash compatibility)

### 2. **PDF Extract Queue (Producer)**
Located at: `src/jobs/queues/pdf-extract.queue.ts`

**Features:**
- Adds PDF extraction jobs to the queue
- Configures retry logic (3 attempts with exponential backoff)
- Manages job retention (completed: 1hr, failed: 24hrs)
- Provides queue metrics and status checks

### 3. **PDF Extract Worker (Consumer)**
Located at: `src/jobs/workers/pdf-extract.worker.ts`

**Process Flow:**
1. Downloads PDF from Supabase URL (10% progress)
2. Extracts text using `pdf-parse` (50% progress)
3. Cleans extracted text (70% progress)
4. Creates a Note in database with extracted content (90% progress)
5. Updates job status to completed (100% progress)

**Features:**
- Real-time progress updates
- Error handling with detailed logging
- Job status tracking in database
- Event listeners (completed, failed, active, progress)

### 4. **Jobs Service & Controller**
- **Service**: Database operations for job metadata
- **Controller**: REST API endpoints for job management

### 5. **Integration**
- ✅ Updated `PdfService` to automatically queue extraction jobs on upload
- ✅ Added `JobsModule` to `AppModule`
- ✅ Connected to existing database schema (uses `Job` model)

## API Endpoints

### Upload PDF (Auto-triggers extraction)
```bash
POST http://localhost:3000/upload
Content-Type: multipart/form-data

file: <PDF file>
userId: "your-user-id"
fileName: "document.pdf"
```

**Response:**
```json
{
  "id": "clx...",
  "url": "https://supabase.../storage/...",
  "name": "document.pdf",
  "userId": "user_123",
  "message": "File uploaded successfully and extraction job queued",
  "jobId": "1"  // <-- BullMQ job ID
}
```

### Check Job Status
```bash
GET http://localhost:3000/jobs/:jobId
```

### Get User's Jobs
```bash
GET http://localhost:3000/jobs/user/:userId?limit=50
```

### Get Queue Jobs
```bash
GET http://localhost:3000/jobs/queue/pdf-extract?limit=50
```

### Clean Up Old Jobs
```bash
DELETE http://localhost:3000/jobs/cleanup?days=7
```

## How It Works

```
┌─────────────┐
│  1. Upload  │  User uploads PDF via /upload
│     PDF     │
└──────┬──────┘
       │
       v
┌─────────────┐
│  2. Queue   │  PdfService adds job to 'pdf-extract' queue
│     Job     │  Job stored in Redis + Database
└──────┬──────┘
       │
       v
┌─────────────┐
│  3. Worker  │  PdfExtractWorker picks up job
│   Process   │  - Downloads PDF from Supabase
│             │  - Extracts text with pdf-parse
│             │  - Saves as Note in database
└──────┬──────┘
       │
       v
┌─────────────┐
│ 4. Complete │  Job marked as completed
│   & Notify  │  Note available for AI processing
└─────────────┘
```

## Database Schema

Jobs are tracked in the `Job` table:

```prisma
model Job {
  id           String    @id @default(cuid())
  jobId        String    @unique // BullMQ job ID
  name         String    // e.g., "extract-pdf"
  data         Json      // Job input data
  status       JobStatus // waiting|active|completed|failed
  progress     Int?      // 0-100
  queueName    String    // "pdf-extract"
  userId       String?
  failedReason String?
  finishedAt   DateTime?
  // ... more fields
}
```

## Configuration

Your `.env` already has the required Redis configuration:

```env
REDIS_HOST="striking-insect-37909.upstash.io"
REDIS_PORT=6379
REDIS_PASSWORD="..."
REDIS_URL="rediss://default:...@striking-insect-37909.upstash.io:6379"
```

## Testing the Queue

### 1. Start the server
```bash
cd backend
npm run start:dev
```

### 2. Upload a test PDF
```bash
curl -X POST http://localhost:3000/upload \
  -F "file=@/path/to/test.pdf" \
  -F "userId=test-user-123" \
  -F "fileName=test.pdf"
```

### 3. Check the job status
```bash
curl http://localhost:3000/jobs/1
```

### 4. View logs
Watch the terminal for worker logs showing:
- Job started
- Progress updates (10%, 50%, 70%, 90%, 100%)
- Text extraction details
- Job completion

## Next Steps

### Phase 2: AI Notes Queue
- Create `ai-notes.queue.ts` and `ai-notes.worker.ts`
- Process extracted text → generate study notes using AI
- Store generated notes in database

### Phase 3: AI Quiz Queue
- Create `ai-quiz.queue.ts` and `ai-quiz.worker.ts`
- Process notes → generate quiz questions using AI
- Store quiz in database

### Phase 4: Completion Queue
- Create `completion.queue.ts` and `completion.worker.ts`
- Coordinate all jobs (PDF → Notes → Quiz)
- Send completion notification to user

### Phase 5: WebSocket Integration
- Integrate with existing `JobsWebSocketGateway`
- Send real-time progress updates to frontend
- Notify user when each stage completes

## File Structure

```
backend/src/jobs/
├── jobs.module.ts              # BullMQ configuration & module setup
├── jobs.service.ts             # Database operations for jobs
├── jobs.controller.ts          # REST API endpoints
├── README.md                   # Documentation
├── queues/
│   └── pdf-extract.queue.ts    # Producer: adds jobs to queue
├── workers/
│   └── pdf-extract.worker.ts   # Consumer: processes PDF extraction
├── dto/
│   └── pdf-extract.dto.ts      # Data transfer objects
└── utils/
    └── pdf-parser.util.ts      # PDF parsing utilities
```

## Monitoring

### Queue Metrics
```typescript
// In your code:
const metrics = await pdfExtractQueue.getQueueMetrics();
// Returns: { waiting, active, completed, failed, delayed, total }
```

### Job Events
The worker emits events you can listen to:
- `completed` - Job finished successfully
- `failed` - Job failed (after retries)
- `active` - Job started processing
- `progress` - Progress updated (10%, 50%, etc.)

## Troubleshooting

### Redis Connection Issues
- Ensure Redis TCP endpoint is accessible
- Check that TLS is enabled for Upstash
- Verify password is correct

### PDF Parsing Errors
- Ensure PDF is not corrupted
- Check PDF is accessible from the URL
- Verify Supabase storage permissions

### Job Not Processing
- Check if worker is running (`npm run start:dev`)
- Verify Redis connection is working
- Check queue metrics for stuck jobs

---

**Status**: ✅ PDF Extract Queue is complete and ready to use!

**Ready for**: Next queue implementation (AI Notes, AI Quiz, or Completion)
