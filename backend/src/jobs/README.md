# BullMQ Jobs Module

This module handles background job processing using BullMQ and Redis.

## Architecture

```
jobs/
├── jobs.module.ts          # Main module configuration
├── jobs.service.ts         # Database operations for jobs
├── jobs.controller.ts      # REST API endpoints for job management
├── queues/                 # Queue producers (add jobs to queues)
│   └── pdf-extract.queue.ts
├── workers/                # Queue consumers (process jobs)
│   └── pdf-extract.worker.ts
├── dto/                    # Data transfer objects
│   └── pdf-extract.dto.ts
└── utils/                  # Helper utilities
    └── pdf-parser.util.ts
```

## PDF Extract Queue

### Flow

1. **Upload**: User uploads PDF via `/upload` endpoint
2. **Queue**: `PdfService` adds extraction job to `pdf-extract` queue
3. **Process**: `PdfExtractWorker` processes the job:
   - Downloads PDF from Supabase
   - Extracts text using `pdf-parse`
   - Creates a Note with extracted content
   - Updates job status in database
4. **Complete**: Job marked as completed with results

### Usage

#### Upload a PDF (triggers extraction)
```bash
POST /upload
Content-Type: multipart/form-data

file: [PDF file]
userId: "user_123"
fileName: "document.pdf"
```

Response:
```json
{
  "id": "file_id",
  "url": "https://...",
  "name": "document.pdf",
  "userId": "user_123",
  "message": "File uploaded successfully and extraction job queued",
  "jobId": "job_123"
}
```

#### Check job status
```bash
GET /jobs/:jobId
```

#### Get user's jobs
```bash
GET /jobs/user/:userId?limit=50
```

#### Get queue jobs
```bash
GET /jobs/queue/pdf-extract?limit=50
```

## Configuration

Add these to your `.env`:

```env
# Redis TCP connection for BullMQ
REDIS_HOST="your-redis-host.upstash.io"
REDIS_PORT=6379
REDIS_PASSWORD="your-redis-password"
```

## Queue Configuration

- **Retries**: 3 attempts with exponential backoff (2s initial delay)
- **Retention**: Completed jobs kept for 1 hour, failed jobs for 24 hours
- **Progress**: Jobs report progress at 10%, 50%, 70%, 90%, 100%

## Database Schema

Jobs are tracked in the `Job` table with:
- `jobId`: BullMQ job ID
- `status`: waiting | active | completed | failed | delayed | paused
- `progress`: 0-100
- `data`: Job input data
- `failedReason`: Error message if failed
- `userId`: User who created the job

## Next Steps

- [ ] Implement AI Notes Queue (process extracted text → generate notes)
- [ ] Implement AI Quiz Queue (generate quiz from notes)
- [ ] Implement Completion Queue (notify user when all jobs complete)
- [ ] Add WebSocket integration for real-time progress updates
