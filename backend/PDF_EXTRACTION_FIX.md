# PDF Extraction Fix - Bad Request Error

## Problem
The PDF extraction worker was failing with a "Bad Request" error when trying to fetch PDFs from Supabase storage. This was happening because:

1. **Public URLs don't work with private buckets** - `getPublicUrl()` returns a URL that requires the bucket to be public
2. **No authentication headers** - The fetch request wasn't including proper authentication
3. **No fallback mechanism** - If the URL failed, there was no alternative method to get the file

## Solution Implemented

### 1. Use Signed URLs Instead of Public URLs
**File: `src/uploads/pdf.service.ts`**

Changed from:
```typescript
const { data: urlData } = this.supabase.storage
  .from(this.bucketName)
  .getPublicUrl(uniqueFileName);
```

To:
```typescript
const { data: urlData, error: urlError } = await this.supabase.storage
  .from(this.bucketName)
  .createSignedUrl(uniqueFileName, 3600); // Valid for 1 hour
```

**Benefits:**
- Works with private buckets (more secure)
- Provides temporary authenticated access
- Expires after 1 hour for security

### 2. Store File Path Instead of Full URL
**File: `src/uploads/pdf.service.ts`**

Now storing the storage path in the database:
```typescript
const fileRecord = await this.databaseService.file.create({
  data: {
    name: createPdfDto.fileName,
    url: uploadData.path, // Store path instead of URL
    userId: createPdfDto.userId,
  },
});
```

This allows us to regenerate signed URLs or download directly from Supabase later.

### 3. Enhanced PDF Fetching with Better Error Handling
**File: `src/jobs/utils/pdf-parser.util.ts`**

Added:
- Proper HTTP headers (User-Agent)
- Detailed logging for debugging
- Content-Type verification
- Better error messages with HTTP status codes

### 4. Implemented Fallback Mechanism
**File: `src/jobs/workers/pdf-extract.worker.ts`**

The worker now tries two methods:
1. **Primary:** Fetch from signed URL
2. **Fallback:** Download directly from Supabase storage using service role key

```typescript
try {
  // Try signed URL first
  const result = await PdfParserUtil.extractTextFromUrl(fileUrl);
  text = result.text;
  pageCount = result.pageCount;
} catch (urlError) {
  // Fallback to direct Supabase download
  const buffer = await PdfParserUtil.downloadFromSupabase(
    supabaseUrl,
    supabaseKey,
    'pdfs',
    filePath,
  );
  const result = await PdfParserUtil.extractTextFromBuffer(buffer);
  text = result.text;
  pageCount = result.pageCount;
}
```

## Key Features

✅ **Secure:** Uses signed URLs with 1-hour expiration
✅ **Reliable:** Fallback mechanism if signed URL fails
✅ **Private:** Works with private Supabase buckets
✅ **Debuggable:** Enhanced logging at each step
✅ **Error-resistant:** Better error messages and handling

## Testing

To test the fix:

1. **Upload a PDF:**
   ```bash
   curl -X POST http://localhost:3000/pdf/upload \
     -F "file=@test.pdf" \
     -F "userId=your-user-id" \
     -F "fileName=test.pdf"
   ```

2. **Check the logs:**
   - Should see: "Fetching PDF from URL..."
   - Should see: "Downloaded X bytes"
   - Should see: "Extracted X characters from Y pages"

3. **Monitor job status:**
   ```bash
   curl http://localhost:3000/jobs/{jobId}
   ```

## What Changed

1. ✏️ `pdf.service.ts` - Generate signed URLs instead of public URLs
2. ✏️ `pdf-parser.util.ts` - Enhanced fetch with headers and logging
3. ✏️ `pdf-extract.worker.ts` - Added fallback download mechanism

## Configuration Required

Ensure these environment variables are set in `.env`:
```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Supabase Bucket Configuration

Your Supabase bucket can now be:
- ✅ **Private** (recommended) - Uses signed URLs and service role key
- ✅ **Public** - Will also work with the new implementation

No need to make the bucket public anymore!

## Notes

- Signed URLs expire after 1 hour - this is intentional for security
- The fallback mechanism uses the service role key which has full access
- File paths are stored in the database, not full URLs
- The system will automatically retry 3 times with exponential backoff
