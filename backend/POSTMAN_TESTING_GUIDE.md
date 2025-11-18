# Postman Testing Guide - TaskFlow API

## 🚀 Quick Setup

### Step 1: Import the Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select the file: `TaskFlow-API.postman_collection.json`
4. Click **Import**

### Step 2: Configure Variables

After importing, configure these collection variables:

1. Click on the collection name "TaskFlow API - Complete Testing Flow"
2. Go to the **Variables** tab
3. Update these values:
   - `baseUrl`: `http://localhost:3000` (or your server URL)
   - `userId`: Your test user ID (e.g., `test-user-123`)
   - `pdfText`: Leave empty for now (will be set manually in Step 2 of testing)

---

## 📋 Complete Testing Flow

### **Step 1: Upload a PDF** 

**Request:** `1. Upload PDF`

**How to test:**

1. Select the request "1. Upload PDF" from the collection
2. Go to **Body** tab
3. In the form-data:
   - For the `file` field: Click "Select Files" and choose your PDF
   - `userId`: Should auto-populate from `{{userId}}` variable
   - `fileName`: Change "My Study Document" to your preferred name
4. Click **Send**

**Expected Response (201):**
```json
{
  "id": "file-id-123",
  "url": "https://supabase-url.../pdfs/...",
  "name": "My Study Document",
  "userId": "test-user-123",
  "message": "File uploaded successfully and extraction job queued",
  "jobId": "job-id-456"
}
```

**What happens:**
- ✅ PDF uploaded to Supabase storage
- ✅ File metadata saved to database
- ✅ Background job queued to extract PDF text
- ✅ `fileId` and `jobId` saved automatically to variables

**⚠️ Important:** The PDF text extraction happens in the background. You'll need to wait for this job to complete before proceeding to Step 2.

---

### **Step 1.5: Get Extracted PDF Text**

Since the PDF extraction happens asynchronously, you need to retrieve the extracted text. You have two options:

**Option A: Check your database/logs for the extracted text**

**Option B: Wait and manually extract the text**
- For testing purposes, you can manually copy text from your PDF
- Or implement a GET endpoint to retrieve the extracted text by fileId

**Set the pdfText variable:**
1. Go to Collection Variables
2. Find the `pdfText` variable
3. Paste your PDF content in the "Current Value" field
4. Click **Save**

---

### **Step 2: Generate Notes from PDF**

**Request:** `2. Generate Notes from PDF Text`

**How to test:**

1. Select "2. Generate Notes from PDF Text"
2. Make sure `{{pdfText}}` variable is set (from Step 1.5)
3. Review the request body:
   ```json
   {
     "pdfText": "{{pdfText}}",
     "userId": "{{userId}}",
     "title": "My Study Notes",
     "source": "My Study Document.pdf"
   }
   ```
4. Optionally change the `title` and `source` fields
5. Click **Send**

**Expected Response (201):**
```json
{
  "id": "note-id-789",
  "userId": "test-user-123",
  "title": "My Study Notes",
  "content": "# Study Notes\n\n## Key Concepts...",
  "source": "My Study Document.pdf",
  "createdAt": "2025-11-16T12:00:00.000Z",
  "updatedAt": "2025-11-16T12:00:00.000Z"
}
```

**What happens:**
- ✅ AI generates formatted study notes
- ✅ Notes saved to database
- ✅ `noteId` and `noteContent` saved automatically to variables

---

### **Step 3: Generate Quiz from Notes**

**Request:** `3. Generate Quiz from Notes`

**How to test:**

1. Select "3. Generate Quiz from Notes"
2. The request will automatically use `{{noteContent}}` and `{{noteId}}` from Step 2
3. Review the request body:
   ```json
   {
     "studyNotes": "{{noteContent}}",
     "userId": "{{userId}}",
     "title": "My Quiz",
     "noteId": "{{noteId}}"
   }
   ```
4. Optionally change the `title`
5. Click **Send**

**Expected Response (201):**
```json
{
  "id": "quiz-id-999",
  "userId": "test-user-123",
  "title": "My Quiz",
  "questions": [
    {
      "question": "What is...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A"
    }
  ],
  "noteId": "note-id-789",
  "score": null,
  "createdAt": "2025-11-16T12:00:00.000Z",
  "updatedAt": "2025-11-16T12:00:00.000Z"
}
```

**What happens:**
- ✅ AI generates quiz questions from notes
- ✅ Quiz saved to database
- ✅ `quizId` saved automatically to variables

---

## 🔍 Additional Requests

### **Get All User Notes**
- Request: `Get All User Notes`
- Returns all notes for the user
- No body required

### **Get Specific Note**
- Request: `Get Specific Note`
- Returns a single note
- Uses `{{noteId}}` from previous steps

### **Get All User Quizzes**
- Request: `Get All User Quizzes`
- Returns all quizzes for the user
- No body required

### **Get Specific Quiz**
- Request: `Get Specific Quiz`
- Returns a single quiz with all questions
- Uses `{{quizId}}` from previous steps

### **Update Quiz Score**
- Request: `Update Quiz Score`
- Update score after completing a quiz
- Body:
  ```json
  {
    "score": 85
  }
  ```
- Score must be between 0-100

### **Update Note**
- Request: `Update Note`
- Edit note content or title
- Body:
  ```json
  {
    "content": "Updated content...",
    "title": "New Title"
  }
  ```

### **Delete Note/Quiz**
- Requests: `Delete Note` and `Delete Quiz`
- Permanently delete resources
- Returns 204 No Content

---

## 🎯 Testing Tips

### 1. **Test in Order**
Follow the numbered requests (1, 2, 3) for the complete flow.

### 2. **Check Console**
Open Postman Console (View → Show Postman Console) to see:
- Saved variable values
- Request/response logs
- Any errors

### 3. **Variables Auto-Save**
The collection has Test Scripts that automatically save:
- `fileId` from Step 1
- `noteId` and `noteContent` from Step 2
- `quizId` from Step 3

### 4. **Manual Variable Override**
You can manually set any variable:
1. Click on collection
2. Go to Variables tab
3. Update "Current Value"
4. Save

### 5. **Environment Setup**
For multiple environments (dev/staging/prod):
1. Create Postman Environments
2. Set `baseUrl` per environment
3. Switch environments as needed

---

## ⚠️ Common Issues

### Issue 1: "No file uploaded"
- **Solution**: Make sure you selected a file in the form-data

### Issue 2: "pdfText is required"
- **Solution**: Set the `{{pdfText}}` variable in Collection Variables

### Issue 3: 404 Not Found
- **Solution**: Check if backend server is running on the correct port

### Issue 4: CORS Error
- **Solution**: Backend should have CORS enabled for your Postman requests

### Issue 5: "noteContent is not set"
- **Solution**: Run Step 2 first to generate notes before creating a quiz

---

## 🧪 Sample Test Data

### Sample PDF Text
```
Introduction to Machine Learning

Machine Learning (ML) is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.

Key Concepts:
1. Supervised Learning - Learning with labeled data
2. Unsupervised Learning - Finding patterns in unlabeled data
3. Reinforcement Learning - Learning through trial and error

Common Algorithms:
- Linear Regression
- Decision Trees
- Neural Networks
- Support Vector Machines
```

### Sample User IDs
- `test-user-123`
- `demo-user-456`
- `student-789`

---

## 📊 Expected Flow Timeline

```
Upload PDF (2-5 seconds)
    ↓
PDF Extraction Job (background, 5-30 seconds)
    ↓
Set pdfText Variable (manual)
    ↓
Generate Notes (10-30 seconds, depends on AI)
    ↓
Generate Quiz (10-30 seconds, depends on AI)
    ↓
View/Update Quiz
```

---

## 🎓 Next Steps

After successful testing:
1. Try different PDF files
2. Test error cases (invalid data, missing fields)
3. Test update and delete operations
4. Create a Postman Test Suite for automated testing
5. Set up Postman Monitors for continuous testing

---

**Happy Testing! 🚀**

If you encounter any issues, check:
- Backend logs
- Postman Console
- Network tab for detailed errors
