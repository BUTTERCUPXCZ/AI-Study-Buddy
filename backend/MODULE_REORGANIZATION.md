# Module Reorganization - Clean AI Folder Structure

## Overview
The AI service has been reorganized into separate, focused modules following NestJS best practices. Notes and quizzes now have their own dedicated modules, controllers, and services.

## New Folder Structure

```
backend/src/
├── ai/                         # AI Generation module (Gemini)
│   ├── ai.module.ts           # Imports Notes & Quizzes modules
│   ├── ai.service.ts          # AI generation logic only
│   ├── ai.controller.ts       # AI generation endpoints
│   ├── dto/
│   │   ├── generate-notes.dto.ts
│   │   ├── generate-quiz.dto.ts
│   │   └── tutor-chat.dto.ts
│   ├── interfaces/
│   │   └── ai-response.interface.ts
│   └── prompts/
│       ├── notes.prompt.ts
│       ├── quiz.prompt.ts
│       └── summary.prompt.ts
│
├── notes/                      # Notes CRUD module
│   ├── notes.module.ts
│   ├── notes.service.ts       # Database operations for notes
│   ├── notes.controller.ts    # REST endpoints for notes
│   └── dto/
│       └── note.dto.ts
│
└── quizzes/                    # Quizzes CRUD module
    ├── quizzes.module.ts
    ├── quizzes.service.ts     # Database operations for quizzes
    ├── quizzes.controller.ts  # REST endpoints for quizzes
    └── dto/
        └── quiz.dto.ts
```

## Module Responsibilities

### 1. AI Module (`src/ai/`)
**Purpose:** AI-powered generation using Google Gemini

**Responsibilities:**
- Generate study notes from PDF text
- Generate quiz questions from study notes
- Handle AI tutor chat sessions
- Coordinate with Notes and Quizzes services to persist data

**Endpoints:**
- `POST /ai/generate/notes` - Generate notes from PDF
- `POST /ai/generate/quiz` - Generate quiz from notes
- `POST /ai/tutor/chat` - Chat with AI tutor
- `GET /ai/tutor/sessions/user/:userId` - Get chat sessions
- `GET /ai/tutor/sessions/:sessionId/user/:userId` - Get session details
- `PUT /ai/tutor/sessions/:sessionId/user/:userId/title` - Update session title
- `DELETE /ai/tutor/sessions/:sessionId/user/:userId` - Delete session

### 2. Notes Module (`src/notes/`)
**Purpose:** CRUD operations for study notes

**Responsibilities:**
- Create, read, update, delete notes
- Manage note metadata (title, source, timestamps)
- User-scoped note queries

**Endpoints:**
- `POST /notes` - Create a note
- `GET /notes/user/:userId` - Get all user notes
- `GET /notes/:noteId/user/:userId` - Get specific note
- `PUT /notes/:noteId/user/:userId` - Update note
- `DELETE /notes/:noteId/user/:userId` - Delete note

### 3. Quizzes Module (`src/quizzes/`)
**Purpose:** CRUD operations for quizzes

**Responsibilities:**
- Create, read, update, delete quizzes
- Manage quiz scores
- Link quizzes to source notes
- User-scoped quiz queries

**Endpoints:**
- `POST /quizzes` - Create a quiz
- `GET /quizzes/user/:userId` - Get all user quizzes
- `GET /quizzes/:quizId/user/:userId` - Get specific quiz
- `PUT /quizzes/:quizId/user/:userId/score` - Update quiz score
- `DELETE /quizzes/:quizId/user/:userId` - Delete quiz

## Service Interactions

```
┌─────────────────┐
│   AI Service    │
│  (Generation)   │
└────────┬────────┘
         │
         ├──────────────┐
         │              │
         ▼              ▼
┌────────────────┐  ┌──────────────┐
│ Notes Service  │  │Quiz Service  │
│   (CRUD)       │  │   (CRUD)     │
└────────┬───────┘  └──────┬───────┘
         │                  │
         └──────┬───────────┘
                ▼
       ┌─────────────────┐
       │ Database Service│
       │    (Prisma)     │
       └─────────────────┘
```

## Key Changes

### AI Service (`ai.service.ts`)
**Before:**
- Handled both AI generation AND database operations
- Directly used DatabaseService for notes and quizzes
- ~400+ lines of code

**After:**
- Focuses ONLY on AI generation
- Delegates database operations to NotesService and QuizzesService
- Cleaner, more focused code

### Notes Service (`notes.service.ts`)
**New service with:**
- `createNote()` - Create a new note
- `getUserNotes()` - Get all user notes
- `getNoteById()` - Get specific note
- `updateNote()` - Update note content/title
- `deleteNote()` - Delete note

### Quizzes Service (`quizzes.service.ts`)
**New service with:**
- `createQuiz()` - Create a new quiz
- `getUserQuizzes()` - Get all user quizzes
- `getQuizById()` - Get specific quiz
- `updateQuizScore()` - Update quiz score
- `deleteQuiz()` - Delete quiz

## API Endpoint Changes

### Notes Endpoints
**Before:** `/ai/notes/*`  
**After:** `/notes/*`

- `POST /ai/notes/generate` → `POST /ai/generate/notes` (AI generation)
- `GET /ai/notes/user/:userId` → `GET /notes/user/:userId`
- `GET /ai/notes/:noteId/user/:userId` → `GET /notes/:noteId/user/:userId`
- `PUT /ai/notes/:noteId/user/:userId` → `PUT /notes/:noteId/user/:userId`
- `DELETE /ai/notes/:noteId/user/:userId` → `DELETE /notes/:noteId/user/:userId`

### Quiz Endpoints
**Before:** `/ai/quiz/*`  
**After:** `/quizzes/*`

- `POST /ai/quiz/generate` → `POST /ai/generate/quiz` (AI generation)
- `GET /ai/quiz/user/:userId` → `GET /quizzes/user/:userId`
- `GET /ai/quiz/:quizId/user/:userId` → `GET /quizzes/:quizId/user/:userId`
- `PUT /ai/quiz/:quizId/user/:userId/score` → `PUT /quizzes/:quizId/user/:userId/score`
- `DELETE /ai/quiz/:quizId/user/:userId` → `DELETE /quizzes/:quizId/user/:userId`

### Chat Endpoints
**No change:** Still at `/ai/tutor/*`

## Usage Examples

### Example 1: Generate and Manage Notes

```typescript
// 1. Generate notes using AI
const generated = await POST('/ai/generate/notes', {
  pdfText: 'PDF content...',
  userId: 'user123',
  title: 'Biology Chapter 1',
  source: 'textbook.pdf'
});
// Returns: { notes: '...', success: true, noteId: 'clx...' }

// 2. Get all notes for user
const allNotes = await GET('/notes/user/user123');

// 3. Update a note
await PUT('/notes/clx.../user/user123', {
  content: 'Updated content',
  title: 'New Title'
});

// 4. Delete a note
await DELETE('/notes/clx.../user/user123');
```

### Example 2: Generate and Manage Quizzes

```typescript
// 1. Generate quiz using AI
const generated = await POST('/ai/generate/quiz', {
  studyNotes: 'Notes content...',
  userId: 'user123',
  title: 'Biology Quiz',
  noteId: 'clx...' // optional
});
// Returns: { questions: [...], success: true, quizId: 'clx...' }

// 2. Get all quizzes for user
const allQuizzes = await GET('/quizzes/user/user123');

// 3. Update quiz score after completion
await PUT('/quizzes/clx.../user/user123/score', {
  score: 85
});

// 4. Delete a quiz
await DELETE('/quizzes/clx.../user/user123');
```

### Example 3: Direct CRUD (No AI)

```typescript
// Create a note manually (without AI)
const note = await POST('/notes', {
  userId: 'user123',
  title: 'My Manual Notes',
  content: 'Content I typed myself...',
  source: null
});

// Create a quiz manually (without AI)
const quiz = await POST('/quizzes', {
  userId: 'user123',
  title: 'My Manual Quiz',
  questions: [
    {
      question: 'What is 2+2?',
      options: { A: '3', B: '4', C: '5', D: '6' },
      correctAnswer: 'B',
      explanation: 'Basic arithmetic'
    }
  ],
  noteId: note.id
});
```

## Benefits of This Structure

✅ **Separation of Concerns**
- AI logic separated from database operations
- Each module has a single responsibility

✅ **Reusability**
- Notes and Quizzes services can be used anywhere
- Not coupled to AI generation

✅ **Testability**
- Easier to test each module independently
- Mock dependencies cleanly

✅ **Scalability**
- Easy to add new features to each module
- Can add caching, validation, etc. per module

✅ **Clean Code**
- Smaller, focused files
- Better organization
- Easier to navigate

✅ **RESTful Routes**
- `/notes/*` for all note operations
- `/quizzes/*` for all quiz operations
- `/ai/*` for AI-powered features

## Migration Steps

When your database is available, run:

```bash
cd backend
npx prisma migrate dev --name add_chat_sessions_and_update_relations
npx prisma generate
```

## Frontend Integration

Update your frontend API calls:

**Before:**
```typescript
// Old routes
GET /ai/notes/user/:userId
PUT /ai/quiz/:quizId/user/:userId/score
```

**After:**
```typescript
// New routes
GET /notes/user/:userId
PUT /quizzes/:quizId/user/:userId/score
```

## Next Steps

1. ✅ Schema updated with chat sessions
2. ✅ Modules created and organized
3. ✅ Services separated by responsibility
4. ⏳ Run database migration
5. ⏳ Update frontend API calls
6. ⏳ Add authentication guards
7. ⏳ Add input validation pipes
8. ⏳ Add API documentation (Swagger)
