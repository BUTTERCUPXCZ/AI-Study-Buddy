# AI Service - Revamped with Database Integration

## Overview

The AI Service has been completely revamped to integrate with the database, providing persistent storage for:
- **Study Notes** - AI-generated summaries from PDFs
- **Quizzes** - AI-generated quiz questions with answers
- **Tutor Chat Sessions** - Interactive Q&A sessions with context-aware AI tutor

## Database Schema Changes

### New Models

#### ChatSession
Represents a conversation session with the AI tutor.
```prisma
model ChatSession {
  id        String   @id @default(cuid())
  title     String?
  messages  ChatMessage[]
  noteId    String?
  note      Note?    @relation(fields: [noteId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### ChatMessage
Individual messages within a chat session.
```prisma
model ChatMessage {
  id        String   @id @default(cuid())
  role      String   // 'user' or 'assistant'
  content   String
  sessionId String
  session   ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}
```

### Updated Models

#### Note
Added tracking for source and timestamps, plus relations to quizzes and chat sessions.
- New field: `source` (optional, tracks PDF source)
- New field: `updatedAt`
- New relation: `quizzes` (one-to-many with Quiz)
- New relation: `chatSessions` (one-to-many with ChatSession)

#### Quiz
Added timestamps and relation to notes.
- New field: `createdAt`
- New field: `updatedAt`
- New field: `noteId` (optional, links quiz to a note)
- New relation: `note` (many-to-one with Note)

## API Endpoints

### Notes Endpoints

#### Generate Notes
```http
POST /ai/notes/generate
Content-Type: application/json

{
  "pdfText": "Raw text extracted from PDF...",
  "userId": "user_id_here",
  "title": "Chapter 1: Introduction to Biology",
  "source": "biology_textbook.pdf" // optional
}

Response:
{
  "notes": "Generated study notes...",
  "success": true,
  "noteId": "clx..."
}
```

#### Get User Notes
```http
GET /ai/notes/user/:userId

Response:
[
  {
    "id": "clx...",
    "title": "Chapter 1: Introduction to Biology",
    "content": "Study notes content...",
    "source": "biology_textbook.pdf",
    "createdAt": "2025-11-16T...",
    "updatedAt": "2025-11-16T...",
    "userId": "user_id"
  }
]
```

#### Get Single Note
```http
GET /ai/notes/:noteId/user/:userId

Response:
{
  "id": "clx...",
  "title": "Chapter 1: Introduction to Biology",
  "content": "Study notes content...",
  "source": "biology_textbook.pdf",
  "createdAt": "2025-11-16T...",
  "updatedAt": "2025-11-16T...",
  "userId": "user_id"
}
```

#### Update Note
```http
PUT /ai/notes/:noteId/user/:userId
Content-Type: application/json

{
  "content": "Updated notes content...",
  "title": "New Title" // optional
}
```

#### Delete Note
```http
DELETE /ai/notes/:noteId/user/:userId
```

### Quiz Endpoints

#### Generate Quiz
```http
POST /ai/quiz/generate
Content-Type: application/json

{
  "studyNotes": "Notes content to generate quiz from...",
  "userId": "user_id_here",
  "title": "Biology Chapter 1 Quiz",
  "noteId": "clx..." // optional, links to a note
}

Response:
{
  "questions": [
    {
      "question": "What is photosynthesis?",
      "options": {
        "A": "Process of...",
        "B": "Another process...",
        "C": "Yet another...",
        "D": "Final option..."
      },
      "correctAnswer": "A",
      "explanation": "Photosynthesis is..."
    }
  ],
  "success": true,
  "quizId": "clx..."
}
```

#### Get User Quizzes
```http
GET /ai/quiz/user/:userId

Response:
[
  {
    "id": "clx...",
    "title": "Biology Chapter 1 Quiz",
    "questions": [...],
    "score": 85,
    "createdAt": "2025-11-16T...",
    "updatedAt": "2025-11-16T...",
    "userId": "user_id",
    "noteId": "clx...",
    "note": {
      "id": "clx...",
      "title": "Chapter 1: Introduction to Biology"
    }
  }
]
```

#### Get Single Quiz
```http
GET /ai/quiz/:quizId/user/:userId

Response:
{
  "id": "clx...",
  "title": "Biology Chapter 1 Quiz",
  "questions": [...],
  "score": 85,
  "createdAt": "2025-11-16T...",
  "note": {
    "id": "clx...",
    "title": "Chapter 1: Introduction to Biology",
    "content": "..."
  }
}
```

#### Update Quiz Score
```http
PUT /ai/quiz/:quizId/user/:userId/score
Content-Type: application/json

{
  "score": 90
}
```

#### Delete Quiz
```http
DELETE /ai/quiz/:quizId/user/:userId
```

### Tutor Chat Endpoints

#### Send Message (Create or Continue Session)
```http
POST /ai/tutor/chat
Content-Type: application/json

{
  "userQuestion": "Can you explain photosynthesis in simple terms?",
  "userId": "user_id_here",
  "sessionId": "clx..." // optional, to continue existing session
  "noteId": "clx..." // optional, provides context from specific note
}

Response:
{
  "answer": "AI tutor's response...",
  "success": true,
  "sessionId": "clx...",
  "messageId": "clx..."
}
```

#### Get User Chat Sessions
```http
GET /ai/tutor/sessions/user/:userId

Response:
[
  {
    "id": "clx...",
    "title": "Can you explain photosynthesis...",
    "noteId": "clx...",
    "note": {
      "id": "clx...",
      "title": "Chapter 1: Introduction to Biology"
    },
    "messages": [
      {
        "id": "clx...",
        "role": "user",
        "content": "First message preview...",
        "createdAt": "2025-11-16T..."
      }
    ],
    "createdAt": "2025-11-16T...",
    "updatedAt": "2025-11-16T..."
  }
]
```

#### Get Chat Session with All Messages
```http
GET /ai/tutor/sessions/:sessionId/user/:userId

Response:
{
  "id": "clx...",
  "title": "Biology Questions",
  "noteId": "clx...",
  "note": {
    "id": "clx...",
    "title": "Chapter 1: Introduction to Biology",
    "content": "..."
  },
  "messages": [
    {
      "id": "clx1",
      "role": "user",
      "content": "What is photosynthesis?",
      "createdAt": "2025-11-16T..."
    },
    {
      "id": "clx2",
      "role": "assistant",
      "content": "Photosynthesis is...",
      "createdAt": "2025-11-16T..."
    }
  ],
  "createdAt": "2025-11-16T...",
  "updatedAt": "2025-11-16T..."
}
```

#### Update Chat Session Title
```http
PUT /ai/tutor/sessions/:sessionId/user/:userId/title
Content-Type: application/json

{
  "title": "Photosynthesis Discussion"
}
```

#### Delete Chat Session
```http
DELETE /ai/tutor/sessions/:sessionId/user/:userId
```

## Service Methods

### Notes Methods

- `generateNotes(pdfText, userId, title, source?)` - Generate and save notes
- `getUserNotes(userId)` - Get all notes for a user
- `getNoteById(noteId, userId)` - Get specific note
- `updateNote(noteId, userId, content, title?)` - Update note content/title
- `deleteNote(noteId, userId)` - Delete note

### Quiz Methods

- `generateQuiz(studyNotes, userId, title, noteId?)` - Generate and save quiz
- `getUserQuizzes(userId)` - Get all quizzes for a user
- `getQuizById(quizId, userId)` - Get specific quiz
- `updateQuizScore(quizId, userId, score)` - Update quiz score
- `deleteQuiz(quizId, userId)` - Delete quiz

### Chat Methods

- `tutorChat(userQuestion, userId, sessionId?, noteId?)` - Send message and get response
- `getUserChatSessions(userId)` - Get all chat sessions for a user
- `getChatSession(sessionId, userId)` - Get specific session with all messages
- `updateChatSessionTitle(sessionId, userId, title)` - Update session title
- `deleteChatSession(sessionId, userId)` - Delete chat session

## Migration

To apply the database schema changes, run:

```bash
cd backend
npx prisma migrate dev --name add_chat_sessions_and_update_relations
```

This will:
1. Create the `ChatSession` and `ChatMessage` tables
2. Add new fields to `Note` and `Quiz` tables
3. Set up all relations

## Usage Examples

### Example 1: Generate Notes from PDF

```typescript
// In your PDF upload service
const pdfText = await extractTextFromPDF(file);
const result = await aiService.generateNotes(
  pdfText,
  user.id,
  'Biology Chapter 1',
  file.originalname
);

if (result.success) {
  console.log('Notes saved with ID:', result.noteId);
}
```

### Example 2: Generate Quiz from Existing Note

```typescript
// Get a note
const note = await aiService.getNoteById(noteId, userId);

// Generate quiz from that note
const quiz = await aiService.generateQuiz(
  note.content,
  userId,
  `${note.title} - Quiz`,
  note.id
);
```

### Example 3: Interactive Tutor Chat

```typescript
// Start a new chat session with context from a note
const response1 = await aiService.tutorChat(
  "What is the main concept in this chapter?",
  userId,
  undefined, // no sessionId = new session
  noteId // provide context
);

// Continue the conversation
const response2 = await aiService.tutorChat(
  "Can you give me an example?",
  userId,
  response1.sessionId // continue same session
);

// Get full conversation history
const session = await aiService.getChatSession(
  response1.sessionId,
  userId
);
```

## Features

✅ **Persistent Storage** - All AI-generated content saved to database
✅ **User Isolation** - All queries filtered by userId for security
✅ **Relations** - Quizzes linked to notes, chats linked to notes
✅ **Chat History** - Full conversation history preserved
✅ **Context-Aware** - Tutor uses note content as context
✅ **CRUD Operations** - Full create, read, update, delete for all entities
✅ **Timestamps** - Track creation and update times
✅ **Error Handling** - Comprehensive error handling with NotFoundException

## Next Steps

1. Add authentication guards to endpoints
2. Implement rate limiting for AI calls
3. Add pagination for list endpoints
4. Implement search functionality
5. Add export functionality (PDF, Markdown)
6. Implement sharing features
7. Add analytics and usage tracking
