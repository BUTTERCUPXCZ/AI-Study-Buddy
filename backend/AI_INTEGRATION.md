# Gemini AI Integration

This document describes the Gemini AI integration in the TaskFlow backend application.

## Overview

The AI module provides three main features:
1. **Study Notes Generation** - Converts PDF text into structured study notes
2. **Quiz Generation** - Creates 20 multiple-choice questions with answers and explanations
3. **AI Tutor Chat** - Answers student questions based on their learning materials

## Setup

### 1. Install Dependencies

```bash
npm install @google/generative-ai
```

### 2. Environment Variables

Add your Gemini API key to your `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

To get a Gemini API key:
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key

## Module Structure

```
src/ai/
├── ai.module.ts                          # AI module definition
├── ai.service.ts                         # AI service with Gemini integration
├── prompts/
│   ├── notes.prompt.ts                   # Study notes generation prompt
│   ├── quiz.prompt.ts                    # Quiz generation prompt
│   └── summary.prompt.ts                 # AI tutor prompt
└── interfaces/
    └── ai-response.interface.ts          # TypeScript interfaces
```

## Usage

### Inject the Service

```typescript
import { AiService } from './ai/ai.service';

@Injectable()
export class YourService {
  constructor(private readonly aiService: AiService) {}
}
```

### 1. Generate Study Notes

```typescript
const pdfText = "Your extracted PDF text here...";
const result = await this.aiService.generateNotes(pdfText);

if (result.success) {
  console.log(result.notes);
} else {
  console.error(result.error);
}
```

**Response Format:**
```typescript
{
  notes: string,      // Generated study notes with headings and bullets
  success: boolean,
  error?: string
}
```

### 2. Generate Quiz Questions

```typescript
const studyNotes = "Your study notes here...";
const result = await this.aiService.generateQuiz(studyNotes);

if (result.success) {
  console.log(result.questions); // Array of 20 questions
} else {
  console.error(result.error);
}
```

**Response Format:**
```typescript
{
  questions: [
    {
      question: "Question text?",
      options: {
        A: "Option A text",
        B: "Option B text",
        C: "Option C text",
        D: "Option D text"
      },
      correctAnswer: "A",  // Can be A, B, C, or D
      explanation: "Brief explanation"
    }
  ],
  success: boolean,
  error?: string
}
```

### 3. AI Tutor Chat

```typescript
const userQuestion = "Explain photosynthesis";
const learningMaterials = "Context from user's uploaded materials...";

const result = await this.aiService.tutorChat(userQuestion, learningMaterials);

if (result.success) {
  console.log(result.answer);
} else {
  console.error(result.error);
}
```

**Response Format:**
```typescript
{
  answer: string,     // AI tutor's response
  success: boolean,
  error?: string
}
```

## Integration Examples

### Example: PDF Upload with Notes Generation

```typescript
@Controller('pdf')
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly aiService: AiService,
  ) {}

  @Post('upload-and-generate-notes')
  async uploadAndGenerateNotes(@UploadedFile() file: Express.Multer.File) {
    // Extract text from PDF
    const pdfText = await this.pdfService.extractText(file);
    
    // Generate study notes
    const notesResult = await this.aiService.generateNotes(pdfText);
    
    if (!notesResult.success) {
      throw new BadRequestException(notesResult.error);
    }
    
    return {
      notes: notesResult.notes,
    };
  }
}
```

### Example: Generate Quiz from Existing Notes

```typescript
@Controller('quiz')
export class QuizController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate')
  async generateQuiz(@Body() body: { noteId: string }) {
    // Fetch notes from database
    const notes = await this.notesService.findById(body.noteId);
    
    // Generate quiz
    const quizResult = await this.aiService.generateQuiz(notes.content);
    
    if (!quizResult.success) {
      throw new BadRequestException(quizResult.error);
    }
    
    // Save quiz to database
    await this.quizService.create({
      noteId: body.noteId,
      questions: quizResult.questions,
    });
    
    return quizResult;
  }
}
```

### Example: AI Tutor with User Context

```typescript
@Controller('tutor')
export class TutorController {
  constructor(
    private readonly aiService: AiService,
    private readonly notesService: NotesService,
  ) {}

  @Post('ask')
  async askTutor(
    @Body() body: { question: string; userId: string }
  ) {
    // Get all user's learning materials for context
    const userNotes = await this.notesService.findByUserId(body.userId);
    const context = userNotes.map(note => note.content).join('\n\n');
    
    // Get AI tutor response
    const tutorResult = await this.aiService.tutorChat(
      body.question,
      context
    );
    
    if (!tutorResult.success) {
      throw new BadRequestException(tutorResult.error);
    }
    
    return {
      answer: tutorResult.answer,
    };
  }
}
```

## Features

### Study Notes Generation
- Converts raw PDF text into structured study notes
- Includes headings and bullet points
- Optimized for college-level exam preparation

### Quiz Generation
- Creates 20 multiple-choice questions
- Each question has 4 options (A, B, C, D)
- Includes correct answer and explanation
- All answers included in response (no need for separate validation calls)
- Questions based on study content

### AI Tutor
- Context-aware responses based on user's learning materials
- Clear and simple explanations
- Personalized to the student's uploaded content

## Error Handling

All AI service methods return a response object with a `success` boolean and optional `error` string:

```typescript
if (!result.success) {
  // Handle error
  console.error(result.error);
  throw new BadRequestException(result.error);
}
```

## Best Practices

1. **Always provide context** for the AI tutor - include user's learning materials
2. **Store quiz results** in the database to avoid regeneration
3. **Cache notes** after generation for faster access
4. **Handle errors gracefully** and provide user feedback
5. **Limit PDF text size** to avoid token limits (consider chunking large documents)
6. **Rate limiting** - Consider implementing rate limiting for AI calls

## Model Information

- **Model**: `gemini-pro`
- **Provider**: Google Generative AI
- **Package**: `@google/generative-ai`

## Troubleshooting

### API Key Issues
- Ensure `GEMINI_API_KEY` is set in your `.env` file
- Verify the API key is valid and active
- Check API quotas in Google AI Studio

### JSON Parsing Errors (Quiz Generation)
- The service handles markdown code blocks automatically
- If issues persist, check the prompt format in `quiz.prompt.ts`

### Context Length Errors
- If PDF text is too long, consider chunking the content
- Use pagination for large documents
- Summarize before generating quizzes

## Future Enhancements

- [ ] Add support for different quiz difficulty levels
- [ ] Implement conversation history for tutor chat
- [ ] Add support for image analysis
- [ ] Multi-language support
- [ ] Fine-tune prompts based on user feedback
- [ ] Add caching layer for common queries

## License

Part of the TaskFlow application.
