# 🚀 Quick Start - WebSocket Testing Guide

## Start the Server

```bash
cd backend
npm run start:dev
```

## Test Method 1: HTML Test Client (Easiest!)

1. Open `backend/src/websocket/test-client.html` in your browser
2. Click "Connect" button
3. Enter a job ID (e.g., "test-job-123")
4. Click "Subscribe to Job"
5. In a new browser tab, visit: `http://localhost:3000/websocket-test/simulate-job/test-job-123`
6. Watch real-time updates in your test client! 🎉

## Test Method 2: Using the Quick Test Endpoint

This is the easiest way to see it work:

1. Open `backend/src/websocket/test-client.html` in your browser
2. Connect and subscribe to job ID: `quick-test-123`
3. Open a new tab and visit: `http://localhost:3000/websocket-test/quick-test/quick-test-123`
4. Watch the magic happen! You'll see:
   - Job started
   - Progress: 33% - Processing step 1
   - Progress: 66% - Processing step 2
   - Progress: 100% - Finalizing
   - Job completed!

## Test Endpoints Available

All endpoints are under `/websocket-test`:

### 1. Simulate Full Job (with automatic progress)
```
GET http://localhost:3000/websocket-test/simulate-job/:jobId
```

### 2. Quick Test (4-second sequence)
```
GET http://localhost:3000/websocket-test/quick-test/:jobId
```

### 3. Manual Update
```
POST http://localhost:3000/websocket-test/update/:jobId
Body: {
  "status": "processing",
  "data": { "message": "Custom update" }
}
```

### 4. Manual Progress
```
POST http://localhost:3000/websocket-test/progress/:jobId
Body: {
  "progress": 50,
  "message": "Halfway there"
}
```

### 5. Manual Complete
```
POST http://localhost:3000/websocket-test/complete/:jobId
Body: {
  "result": "Success!",
  "itemsProcessed": 100
}
```

### 6. Manual Error
```
POST http://localhost:3000/websocket-test/error/:jobId
Body: {
  "error": "Something went wrong"
}
```

### 7. Get Job History
```
GET http://localhost:3000/websocket-test/history/:jobId
```

### 8. Broadcast to All
```
POST http://localhost:3000/websocket-test/broadcast
Body: {
  "message": "Server maintenance in 5 minutes"
}
```

### 9. Notify Specific User
```
POST http://localhost:3000/websocket-test/notify/:userId
Body: {
  "title": "New notification",
  "message": "You have a new message"
}
```

## Example Test Flow

### Step-by-Step:

1. **Start Backend:**
   ```bash
   cd backend
   npm run start:dev
   ```

2. **Open Test Client:**
   - Open `backend/src/websocket/test-client.html` in browser
   - Click "Connect"
   - Should see "✅ Connected to WebSocket server"

3. **Subscribe to a Job:**
   - Enter job ID: `demo-job-2024`
   - Click "Subscribe to Job"
   - Should see confirmation in log

4. **Trigger the Job:**
   - Open new browser tab
   - Visit: `http://localhost:3000/websocket-test/simulate-job/demo-job-2024`
   
5. **Watch Real-time Updates:**
   - Progress bar should animate from 0% to 100%
   - Event log should show all updates
   - Should see: started → 25% → 50% → 75% → 100% → completed

## Testing with Postman

1. Create a new WebSocket request
2. URL: `ws://localhost:3000/jobs`
3. Connect
4. Send message:
   ```json
   {
     "event": "subscribe:jobs",
     "data": { "jobId": "test-123" }
   }
   ```
5. Trigger a job and watch updates!

## Testing with Browser Console

```javascript
const socket = io('http://localhost:3000/jobs');

socket.on('connect', () => {
  console.log('✅ Connected');
  socket.emit('subscribe:jobs', { jobId: 'browser-test' });
});

socket.on('job:update', data => console.log('📊 Update:', data));
socket.on('job:progress', data => console.log('⏳ Progress:', data));
socket.on('job:completed', data => console.log('✅ Completed:', data));
socket.on('job:error', data => console.log('❌ Error:', data));

// Then visit:
// http://localhost:3000/websocket-test/simulate-job/browser-test
```

## Integration Example

Once tested, integrate into your AI service:

```typescript
import { JobsWebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class AiService {
  constructor(private wsGateway: JobsWebSocketGateway) {}

  async generateNotes(pdfText: string, userId: string) {
    const jobId = `notes-${Date.now()}`;
    
    await this.wsGateway.emitJobUpdate(jobId, 'started', {});
    // Your existing code...
    await this.wsGateway.emitJobCompleted(jobId, result);
    
    return jobId;
  }
}
```

## Troubleshooting

### Can't Connect?
- Check backend is running on port 3000
- Check for errors in terminal
- Try refreshing the test client page

### No Updates?
- Make sure you subscribed to the correct job ID
- Check job ID matches in both subscription and trigger
- Look for errors in browser console

### Redis Issues?
- Verify Redis credentials in `.env`
- Check Redis service is running
- Updates will still work without Redis (just no history)

## Next Steps

- ✅ Test with the HTML client
- ✅ Try all the test endpoints
- ✅ Integrate into your AI service
- ✅ Add to your frontend
- ✅ Add authentication
- ✅ Deploy to production

Enjoy your real-time WebSocket updates! 🎉
