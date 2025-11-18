# WebSocket Module Documentation

## Overview
This WebSocket module provides real-time job updates integrated with Redis for persistent storage and connection management.

## Installation
The following packages have been installed:
- `@nestjs/websockets`
- `@nestjs/platform-socket.io`
- `socket.io`

## Module Structure
```
websocket/
├── websocket.gateway.ts    # WebSocket gateway with Redis integration
└── websocket.module.ts     # Module definition
```

## Features

### 1. **Real-time Job Updates**
- Job status updates
- Job completion notifications
- Job error notifications
- Job progress tracking

### 2. **Redis Integration**
- Client connection tracking
- Subscription management
- Job history storage (last 100 updates per job)
- 24-hour data retention

### 3. **Room-based Subscriptions**
- Subscribe to specific jobs: `job:{jobId}`
- Subscribe to user-specific updates: `user:{userId}`
- Subscribe to all jobs: `all-jobs`

## Usage

### Backend Usage

#### Inject the Gateway into Your Service

```typescript
import { Injectable } from '@nestjs/common';
import { JobsWebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class YourService {
  constructor(private readonly wsGateway: JobsWebSocketGateway) {}

  async processJob(jobId: string) {
    // Emit job started
    await this.wsGateway.emitJobUpdate(jobId, 'started', { 
      message: 'Job processing started' 
    });

    // Emit progress
    await this.wsGateway.emitJobProgress(jobId, 25, 'Processing step 1');
    await this.wsGateway.emitJobProgress(jobId, 50, 'Processing step 2');
    await this.wsGateway.emitJobProgress(jobId, 75, 'Processing step 3');

    try {
      // Your job logic here
      const result = await this.performWork();

      // Emit completion
      await this.wsGateway.emitJobCompleted(jobId, result);
    } catch (error) {
      // Emit error
      await this.wsGateway.emitJobError(jobId, error);
    }
  }
}
```

### Frontend Usage (React Example)

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

function JobMonitor({ jobId }: { jobId: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('http://localhost:3000/jobs', {
      transports: ['websocket'],
    });

    setSocket(newSocket);

    // Subscribe to job updates
    newSocket.emit('subscribe:jobs', { jobId });

    // Listen for job updates
    newSocket.on('job:update', (data) => {
      console.log('Job update:', data);
      setJobStatus(data);
    });

    // Listen for progress updates
    newSocket.on('job:progress', (data) => {
      console.log('Job progress:', data);
      setProgress(data.progress);
    });

    // Listen for completion
    newSocket.on('job:completed', (data) => {
      console.log('Job completed:', data);
      setJobStatus(data);
    });

    // Listen for errors
    newSocket.on('job:error', (data) => {
      console.error('Job error:', data);
      setJobStatus(data);
    });

    // Cleanup
    return () => {
      newSocket.emit('unsubscribe:jobs', { jobId });
      newSocket.disconnect();
    };
  }, [jobId]);

  return (
    <div>
      <h2>Job Status: {jobStatus?.status}</h2>
      <progress value={progress} max={100} />
      <p>{progress}%</p>
    </div>
  );
}
```

## WebSocket Events

### Client → Server

#### `subscribe:jobs`
Subscribe to job updates.

**Payload:**
```typescript
{
  jobId?: string;    // Subscribe to specific job
  userId?: string;   // Subscribe to user's jobs
  // Omit both to subscribe to all jobs
}
```

**Response:**
```typescript
{
  success: boolean;
  room: string;
  message: string;
}
```

#### `unsubscribe:jobs`
Unsubscribe from job updates.

**Payload:** Same as `subscribe:jobs`

### Server → Client

#### `job:update`
General job status update.

**Payload:**
```typescript
{
  jobId: string;
  status: string;
  data: any;
  timestamp: string;
}
```

#### `job:progress`
Job progress update.

**Payload:**
```typescript
{
  jobId: string;
  status: 'in_progress';
  progress: number;    // 0-100
  message?: string;
  timestamp: string;
}
```

#### `job:completed`
Job completion notification.

**Payload:**
```typescript
{
  jobId: string;
  status: 'completed';
  result: any;
  timestamp: string;
}
```

#### `job:error`
Job error notification.

**Payload:**
```typescript
{
  jobId: string;
  status: 'failed';
  error: string;
  timestamp: string;
}
```

## Gateway Methods

### Public Methods

- `emitJobUpdate(jobId, status, data)` - Emit general job update
- `emitJobCompleted(jobId, result)` - Emit job completion
- `emitJobError(jobId, error)` - Emit job error
- `emitJobProgress(jobId, progress, message?)` - Emit progress update
- `getJobHistory(jobId, limit?)` - Get job update history from Redis
- `broadcastToAll(event, data)` - Broadcast to all connected clients
- `emitToUser(userId, event, data)` - Send message to specific user

## Redis Keys Used

- `client:{clientId}` - Client connection metadata
- `subscriptions:{clientId}` - Client subscriptions (Set)
- `job-history:{jobId}` - Job update history (List, max 100 items)

## Configuration

### CORS Configuration
Update the CORS settings in `websocket.gateway.ts`:

```typescript
@WSGateway({
  cors: {
    origin: 'http://localhost:5173', // Your frontend URL
    credentials: true,
  },
  namespace: '/jobs',
})
```

### Namespace
The gateway uses the `/jobs` namespace. Connect using:
```typescript
const socket = io('http://localhost:3000/jobs');
```

## Testing

You can test the WebSocket connection using:

1. **Postman** - Has WebSocket support
2. **wscat** - Command-line WebSocket client
   ```bash
   npm install -g wscat
   wscat -c ws://localhost:3000/jobs
   ```

3. **Browser Console:**
   ```javascript
   const socket = io('http://localhost:3000/jobs');
   socket.on('connect', () => console.log('Connected'));
   socket.emit('subscribe:jobs', { jobId: 'test-123' });
   socket.on('job:update', (data) => console.log('Update:', data));
   ```

## Example: AI Service Integration

```typescript
// In your AI service
import { JobsWebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class AiService {
  constructor(
    private readonly wsGateway: JobsWebSocketGateway,
  ) {}

  async generateFlashcards(jobId: string, documentId: string) {
    await this.wsGateway.emitJobUpdate(jobId, 'started', {
      message: 'Starting flashcard generation',
    });

    await this.wsGateway.emitJobProgress(jobId, 10, 'Extracting text');
    const text = await this.extractText(documentId);

    await this.wsGateway.emitJobProgress(jobId, 40, 'Analyzing content');
    const analysis = await this.analyzeContent(text);

    await this.wsGateway.emitJobProgress(jobId, 70, 'Generating flashcards');
    const flashcards = await this.generateCards(analysis);

    await this.wsGateway.emitJobProgress(jobId, 90, 'Saving results');
    await this.saveFlashcards(flashcards);

    await this.wsGateway.emitJobCompleted(jobId, {
      flashcards,
      count: flashcards.length,
    });
  }
}
```

## Security Considerations

1. **Authentication**: Consider adding authentication middleware to verify WebSocket connections
2. **Rate Limiting**: Implement rate limiting for subscriptions
3. **Input Validation**: Validate all incoming messages
4. **CORS**: Configure CORS properly for production

## Next Steps

1. Add authentication to WebSocket connections
2. Implement user-specific rooms with proper authorization
3. Add connection pooling and load balancing for scaling
4. Implement reconnection logic on the client side
5. Add metrics and monitoring for WebSocket connections
