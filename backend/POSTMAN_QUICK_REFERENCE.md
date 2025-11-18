# 🚀 Quick Postman Testing Reference

## Files Created
✅ `TaskFlow-API.postman_collection.json` - Import this into Postman
✅ `POSTMAN_TESTING_GUIDE.md` - Detailed testing guide
✅ `sample-pdf-text.txt` - Sample PDF content for testing

---

## 🎯 Quick Start (3 Steps)

### 1️⃣ Import Collection
```
Postman → Import → Select "TaskFlow-API.postman_collection.json"
```

### 2️⃣ Set Variables
```
Collection → Variables tab → Update:
- baseUrl: http://localhost:3000
- userId: test-user-123
```

### 3️⃣ Start Testing
Run requests in order: 1 → 2 → 3

---

## 📋 Testing Flow Cheat Sheet

| Step | Endpoint | Method | What to Do |
|------|----------|--------|------------|
| 1 | `/upload` | POST | Select PDF file in form-data |
| 1.5 | Manual | - | Copy `sample-pdf-text.txt` to `{{pdfText}}` variable |
| 2 | `/ai/generate/notes` | POST | Click Send (uses `{{pdfText}}`) |
| 3 | `/ai/generate/quiz` | POST | Click Send (uses `{{noteContent}}`) |

---

## 🔧 Collection Variables

| Variable | Set When | Used In |
|----------|----------|---------|
| `baseUrl` | Manual setup | All requests |
| `userId` | Manual setup | All requests |
| `pdfText` | Manual (Step 1.5) | Step 2 |
| `fileId` | Auto (Step 1) | Future use |
| `noteId` | Auto (Step 2) | Step 3, Get Note |
| `noteContent` | Auto (Step 2) | Step 3 |
| `quizId` | Auto (Step 3) | Get Quiz, Update Score |

---

## 📝 Request Bodies Quick Reference

### Step 1: Upload PDF (form-data)
```
file: [Select your PDF]
userId: {{userId}}
fileName: My Study Document
```

### Step 2: Generate Notes (JSON)
```json
{
  "pdfText": "{{pdfText}}",
  "userId": "{{userId}}",
  "title": "My Study Notes",
  "source": "document.pdf"
}
```

### Step 3: Generate Quiz (JSON)
```json
{
  "studyNotes": "{{noteContent}}",
  "userId": "{{userId}}",
  "title": "My Quiz",
  "noteId": "{{noteId}}"
}
```

### Update Quiz Score (JSON)
```json
{
  "score": 85
}
```

---

## ⚡ Pro Tips

1. **Check Console**: View → Show Postman Console (see logs)
2. **Variables Auto-Save**: IDs automatically saved after each request
3. **Test Order**: Always run 1 → 2 → 3 for first test
4. **Sample Data**: Use `sample-pdf-text.txt` for `{{pdfText}}`
5. **Backend Running**: Ensure backend is running on port 3000

---

## 🐛 Quick Troubleshooting

| Error | Solution |
|-------|----------|
| No file uploaded | Select PDF in form-data |
| pdfText required | Set `{{pdfText}}` variable |
| 404 Not Found | Check backend is running |
| noteContent not set | Run Step 2 first |
| CORS error | Check backend CORS config |

---

## 📊 Expected Response Codes

| Request | Success Code | Returns |
|---------|-------------|---------|
| Upload PDF | 201 | File ID, URL, Job ID |
| Generate Notes | 201 | Note ID, Content |
| Generate Quiz | 201 | Quiz ID, Questions |
| Get Notes/Quizzes | 200 | Data array |
| Update | 200 | Updated data |
| Delete | 204 | No content |

---

## 🎓 Test Scenario

```
1. Import collection ✓
2. Set userId to "test-user-123" ✓
3. Run "1. Upload PDF" with a test PDF ✓
4. Copy sample-pdf-text.txt content ✓
5. Paste into {{pdfText}} variable ✓
6. Run "2. Generate Notes from PDF Text" ✓
7. Run "3. Generate Quiz from Notes" ✓
8. Run "Get Specific Quiz" to see questions ✓
9. Run "Update Quiz Score" with score 85 ✓
10. Run "Get All User Quizzes" to verify ✓
```

---

## 🌐 All Available Endpoints

```
POST   /upload                                    - Upload PDF
POST   /ai/generate/notes                         - Generate notes
POST   /ai/generate/quiz                          - Generate quiz
GET    /notes/user/:userId                        - Get all notes
GET    /notes/:noteId/user/:userId                - Get one note
PUT    /notes/:noteId/user/:userId                - Update note
DELETE /notes/:noteId/user/:userId                - Delete note
GET    /quizzes/user/:userId                      - Get all quizzes
GET    /quizzes/:quizId/user/:userId              - Get one quiz
PUT    /quizzes/:quizId/user/:userId/score        - Update score
DELETE /quizzes/:quizId/user/:userId              - Delete quiz
```

---

**Need Help?** Check `POSTMAN_TESTING_GUIDE.md` for detailed instructions!
