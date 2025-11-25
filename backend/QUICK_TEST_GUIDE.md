# Quick Test Guide - PDF Processing Fix

## 🚀 Start the Backend

```bash
cd backend
npm run start:dev
```

Wait for:
```
[NestApplication] Nest application successfully started
WebSocket Gateway initialized
PDF Notes Optimized Worker ready
```

## 📝 Test 1: Upload a PDF

### Option A: Use Postman/Thunder Client
```
POST http://localhost:3000/jobs/pdf-notes
Content-Type: multipart/form-data

file: [select your PDF file]
userId: [your user id]
```

### Option B: Use cURL
```bash
curl -X POST http://localhost:3000/jobs/pdf-notes \
  -F "file=@/path/to/your/document.pdf" \
  -F "userId=your-user-id-here" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ✅ What to Look For

### Success Indicators:
1. **No errors in console** (was showing `pdfParse is not a function`)
2. **Processing logs**:
   ```
   🚀 [OPTIMIZED] Processing: document.pdf
   📥 Downloaded 512.45KB in 1234ms
   📄 Extracted 45000 chars from 25 pages in 1850ms
   🤖 AI processing completed in 3200ms
   💾 Saved to DB in 150ms
   ✅ COMPLETED in 6500ms
   ```

3. **Fast completion** (3-8 seconds for 500KB PDF)

### Cache Hit Test:
Upload the same PDF again:
```
⚡ CACHE HIT - Returning cached notes instantly
✅ Completed in 1500ms (CACHE HIT)
```

## 🔍 Troubleshooting

### If you see `pdfParse is not a function`:
```bash
# Rebuild the project
cd backend
npm run build
npm run start:dev
```

### If processing is slow:
Check Redis connection:
```bash
# In backend/.env
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-password
```

### View job status:
```bash
# GET job status
curl http://localhost:3000/jobs/:jobId
```

## 📊 Performance Expectations

| PDF Size | Expected Time | Notes |
|----------|--------------|-------|
| < 500KB | 3-5 seconds | Small documents |
| 500KB-2MB | 5-8 seconds | Medium documents |
| 2MB+ | 15-25 seconds | Large documents |
| Cache Hit | < 2 seconds | Any size |

## 🎯 Quick Validation Checklist

- [ ] Backend starts without errors
- [ ] Can upload PDF successfully
- [ ] Processing completes (no `pdfParse is not a function` error)
- [ ] Generated notes appear in database
- [ ] Second upload of same PDF is faster (cache hit)
- [ ] WebSocket updates are sent during processing

## 📱 Frontend Testing (if applicable)

1. Open your frontend app
2. Navigate to PDF upload page
3. Select a PDF file
4. Watch progress bar (should show real-time updates)
5. Notes should appear when complete

## 🐛 Common Issues

### Issue: "Cannot find module 'pdf-parse'"
**Fix**: 
```bash
cd backend
npm install pdf-parse@latest
npm run build
```

### Issue: Job stuck at "extracting_text"
**Fix**: Check logs for extraction errors, ensure PDF is valid

### Issue: Slow processing
**Fix**: 
- Check Redis connection (caching may not be working)
- Verify Gemini API key is valid
- Check system resources (CPU/memory)

## 🎉 Success!

If you see this output, everything is working:
```
✅ COMPLETED in 6500ms (TARGET: 5-10s)
📊 Job pdf-notes-opt-xxx completed successfully
```

Notes will be available in the database and through your API!
