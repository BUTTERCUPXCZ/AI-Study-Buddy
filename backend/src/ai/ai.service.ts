import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { NotesService } from '../notes/notes.service';
import { QuizzesService } from '../quizzes/quizzes.service';
import { NOTES_GENERATION_PROMPT } from './prompts/notes.prompt';
import { QUIZ_GENERATION_PROMPT } from './prompts/quiz.prompt';
import { TUTOR_PROMPT } from './prompts/summary.prompt';
import {
  GenerateNotesResponse,
  GenerateQuizResponse,
  TutorChatResponse,
  QuizQuestion,
} from './interfaces/ai-response.interface';
import { ChatSession, ChatMessage, Note, Prisma } from '@prisma/client';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notesService: NotesService,
    private readonly quizzesService: QuizzesService,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-flash which supports file inputs (PDFs, images, etc.)
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  /**
   * Generate study notes from PDF text and save to database
   */
  async generateNotes(
    pdfText: string,
    userId: string,
    title: string,
    source?: string,
  ): Promise<GenerateNotesResponse & { noteId?: string }> {
    try {
      this.logger.log('Generating study notes...');
      const prompt = NOTES_GENERATION_PROMPT(pdfText);
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const notes = this.cleanGeneratedText(response.text());

      // Save notes to database using NotesService
      const noteRecord = await this.notesService.createNote(
        userId,
        title,
        notes,
        source,
      );

      this.logger.log(`Notes saved with ID: ${noteRecord.id}`);

      return {
        notes,
        success: true,
        noteId: noteRecord.id,
      };
    } catch (error: unknown) {
      this.logger.error('Error generating notes:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        notes: '',
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate structured study notes from extracted text (for worker)
   * This method is optimized for background job processing
   */
  async generateStructuredNotes(
    extractedText: string,
    fileName: string,
    userId: string,
    fileId: string,
  ): Promise<{
    noteId: string;
    title: string;
    content: string;
    summary: string;
  }> {
    try {
      this.logger.log(`Generating structured notes for ${fileName}...`);

      // Create enhanced prompt for structured note generation
      const prompt = this.createStructuredNotesPrompt(extractedText, fileName);

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const generatedContent = this.cleanGeneratedText(response.text());

      // Generate a title from the filename or content
      const title = this.generateTitleFromFileName(fileName);

      // Save notes to database
      const noteRecord = await this.notesService.createNote(
        userId,
        title,
        generatedContent,
        fileId, // Link to the source file
      );

      this.logger.log(`Structured notes saved with ID: ${noteRecord.id}`);

      // Extract summary (first 200 characters)
      const summary = generatedContent.substring(0, 200) + '...';

      return {
        noteId: noteRecord.id,
        title: noteRecord.title,
        content: noteRecord.content,
        summary,
      };
    } catch (error: unknown) {
      this.logger.error('Error generating structured notes:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred while generating structured notes');
    }
  }

  /**
   * Generate structured study notes directly from PDF file
   * This method uses Gemini's file API to read PDFs directly without text extraction
   */
  async generateNotesFromPDF(
    pdfBuffer: Buffer,
    fileName: string,
    userId: string,
    fileId: string,
    mimeType: string = 'application/pdf',
  ): Promise<{
    noteId: string;
    title: string;
    content: string;
    summary: string;
  }> {
    try {
      this.logger.log(`Generating notes directly from PDF: ${fileName}...`);

      // Convert buffer to base64 for inline data
      const base64Data = pdfBuffer.toString('base64');

      // Generate a title from the filename
      const title = this.generateTitleFromFileName(fileName);

      const prompt = `
You are an advanced study assistant. Analyze the PDF content and generate high-quality, exam-ready study notes.

Your output must follow this structure and tone:
- Clear, structured, concise
- Uses headings, bullets, icons, and clean formatting
- Reads like a polished study guide created by an expert educator
- Prioritizes clarity, comprehension, and exam relevance

# ${title}

## 📘 Overview
Provide a short, clear description of what the document covers and why it matters.

## 🎯 Key Concepts
List and explain the essential ideas, principles, or theories presented in the material.

## 📝 Detailed Notes
Break down the content into logical topics and subtopics.
For each topic, provide:
- A clear explanation
- Important bullet points
- Examples or notes when useful

### Topic 1
- Key idea
- Important detail
- Additional points

### Topic 2
- Key idea
- Important detail

(Continue adding topics as necessary based on the PDF.)

## 💡 Must-Know Points
Highlight the most important takeaways a student should remember for exams.

- Critical concept 1  
- Critical concept 2  
- Critical concept 3  

## 🔑 Key Terms & Definitions
List important vocabulary with simple, accurate definitions.

- **Term 1** — Definition  
- **Term 2** — Definition  

## 📚 Final Summary
Wrap up the entire content with a concise, easy-to-understand summary.

---

Now analyze the PDF and produce polished, comprehensive study notes following the structure above.
`;

      // Send PDF to Gemini with inline data
      const result = await this.model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        prompt,
      ]);

      const response = result.response;
      const generatedContent = this.cleanGeneratedText(response.text());

      this.logger.log(
        `Generated ${generatedContent.length} characters of notes`,
      );

      // Save notes to database
      const noteRecord = await this.notesService.createNote(
        userId,
        title,
        generatedContent,
        fileId, // Link to the source file
      );

      this.logger.log(`Notes saved with ID: ${noteRecord.id}`);

      // Extract summary (first 200 characters)
      const summary = generatedContent.substring(0, 200) + '...';

      return {
        noteId: noteRecord.id,
        title: noteRecord.title,
        content: noteRecord.content,
        summary,
      };
    } catch (error: unknown) {
      this.logger.error('Error generating notes from PDF:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred while generating notes from PDF');
    }
  }

  /**
   * Clean generated text by removing markdown code blocks and extra whitespace
   */
  private cleanGeneratedText(text: string): string {
    // Remove markdown code blocks if present (e.g. ```markdown ... ``` or just ``` ... ```)
    let cleaned = text
      .replace(/^```(?:markdown)?\s*/i, '')
      .replace(/^```\s*/, '');
    cleaned = cleaned.replace(/```\s*$/, '');

    // Remove any other potential leading/trailing whitespace
    return cleaned.trim();
  }

  /**
   * Create an enhanced prompt for structured note generation
   */
  private createStructuredNotesPrompt(text: string, fileName: string): string {
    return `You are an expert study assistant. Create comprehensive, well-structured study notes from the following document text.

Document: ${fileName}

Text Content:
${text.substring(0, 15000)} ${text.length > 15000 ? '...(truncated for length)' : ''}

Please create detailed study notes with the following structure:

# [Main Title]

## 📋 Overview
[Provide a brief overview of the document's main purpose and scope]

## 🎯 Key Concepts
[List and explain the main concepts, theories, or ideas]

## 📝 Detailed Notes

### [Topic 1]
[Detailed explanation with important points]
- Key point 1
- Key point 2
- Key point 3

### [Topic 2]
[Detailed explanation with important points]
- Key point 1
- Key point 2

[Continue with additional topics as needed]

## 💡 Important Points to Remember
- [Critical concept 1]
- [Critical concept 2]
- [Critical concept 3]

## 📚 Summary
[Provide a concise summary of the entire document]

## 🔑 Key Terms and Definitions
- **Term 1**: Definition
- **Term 2**: Definition

Make the notes:
- Clear and easy to understand
- Well-organized with proper headings
- Suitable for studying and exam preparation
- Include important details but remain concise
- Use bullet points and formatting for better readability`;
  }

  /**
   * Generate a clean title from filename
   */
  private generateTitleFromFileName(fileName: string): string {
    // Remove extension
    let title = fileName.replace(/\.[^/.]+$/, '');

    // Replace special characters with spaces
    title = title.replace(/[-_]/g, ' ');

    // Capitalize first letter of each word
    title = title.replace(/\b\w/g, (char) => char.toUpperCase());

    return title.trim() || 'Study Notes';
  }

  /**
   * Generate quiz questions from study notes and save to database
   */
  async generateQuiz(
    studyNotes: string,
    userId: string,
    title: string,
    noteId?: string,
  ): Promise<GenerateQuizResponse & { quizId?: string }> {
    try {
      this.logger.log('Generating quiz questions...');
      const prompt = QUIZ_GENERATION_PROMPT(studyNotes);
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Extract JSON from the response (handle markdown code blocks)
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const questions = JSON.parse(jsonText) as QuizQuestion[];

      // Save quiz to database using QuizzesService
      const quizRecord = await this.quizzesService.createQuiz(
        userId,
        title,
        questions as unknown as Prisma.InputJsonValue,
        noteId,
      );

      this.logger.log(`Quiz saved with ID: ${quizRecord.id}`);

      return {
        questions,
        success: true,
        quizId: quizRecord.id,
      };
    } catch (error: unknown) {
      this.logger.error('Error generating quiz:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        questions: [],
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * AI Tutor chat - answers questions based on user's learning materials
   * Creates or continues a chat session
   */
  async tutorChat(
    userQuestion: string,
    userId: string,
    sessionId?: string,
    noteId?: string,
  ): Promise<TutorChatResponse & { sessionId?: string; messageId?: string }> {
    try {
      this.logger.log('Processing tutor chat...');

      // Get or create chat session
      type ChatSessionWithRelations = ChatSession & {
        messages: ChatMessage[];
        note: Note | null;
      };

      let chatSession: ChatSessionWithRelations | null;
      if (sessionId) {
        chatSession = await this.databaseService.chatSession.findFirst({
          where: {
            id: sessionId,
            userId,
          },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
            note: true,
          },
        });

        if (!chatSession) {
          throw new NotFoundException('Chat session not found');
        }
      } else {
        // Create new session
        chatSession = await this.databaseService.chatSession.create({
          data: {
            userId,
            noteId: noteId || null,
            title: userQuestion.substring(0, 50) + '...', // Use first part of question as title
          },
          include: {
            messages: true,
            note: true,
          },
        });
      }

      // Get learning materials context (optional)
      let learningMaterialsContext = '';
      if (chatSession.note) {
        learningMaterialsContext = chatSession.note.content;
      } else if (noteId) {
        const note = await this.databaseService.note.findUnique({
          where: { id: noteId },
        });
        if (note) {
          learningMaterialsContext = note.content;
        }
      }

      // Save user message
      await this.databaseService.chatMessage.create({
        data: {
          role: 'user',
          content: userQuestion,
          sessionId: chatSession.id,
        },
      });

      // Generate AI response
      // Pass context only if available, otherwise use general knowledge
      const prompt = TUTOR_PROMPT(
        userQuestion,
        learningMaterialsContext || undefined,
      );
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const answer = response.text();

      // Save AI response
      const assistantMessage = await this.databaseService.chatMessage.create({
        data: {
          role: 'assistant',
          content: answer,
          sessionId: chatSession.id,
        },
      });

      this.logger.log(`Chat message saved in session: ${chatSession.id}`);

      return {
        answer,
        success: true,
        sessionId: chatSession.id,
        messageId: assistantMessage.id,
      };
    } catch (error: unknown) {
      this.logger.error('Error in tutor chat:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        answer: '',
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * AI Tutor chat with streaming support
   * Streams the response chunk by chunk using Server-Sent Events
   */
  async tutorChatStream(
    userQuestion: string,
    userId: string,
    res: Response,
    sessionId?: string,
    noteId?: string,
  ): Promise<void> {
    try {
      this.logger.log('Processing tutor chat with streaming...');

      // Get or create chat session
      type ChatSessionWithRelations = ChatSession & {
        messages: ChatMessage[];
        note: Note | null;
      };

      let chatSession: ChatSessionWithRelations | null;
      if (sessionId) {
        chatSession = await this.databaseService.chatSession.findFirst({
          where: {
            id: sessionId,
            userId,
          },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
            note: true,
          },
        });

        if (!chatSession) {
          throw new NotFoundException('Chat session not found');
        }
      } else {
        // Create new session
        chatSession = await this.databaseService.chatSession.create({
          data: {
            userId,
            noteId: noteId || null,
            title: userQuestion.substring(0, 50) + '...', // Use first part of question as title
          },
          include: {
            messages: true,
            note: true,
          },
        });
      }

      // Get learning materials context (optional)
      let learningMaterialsContext = '';
      if (chatSession.note) {
        learningMaterialsContext = chatSession.note.content;
      } else if (noteId) {
        const note = await this.databaseService.note.findUnique({
          where: { id: noteId },
        });
        if (note) {
          learningMaterialsContext = note.content;
        }
      }

      // Save user message
      await this.databaseService.chatMessage.create({
        data: {
          role: 'user',
          content: userQuestion,
          sessionId: chatSession.id,
        },
      });

      // Send session info first
      res.write(
        `data: ${JSON.stringify({
          type: 'session',
          sessionId: chatSession.id,
        })}\n\n`,
      );

      // Generate AI response with streaming
      // Pass context only if available, otherwise use general knowledge
      const prompt = TUTOR_PROMPT(
        userQuestion,
        learningMaterialsContext || undefined,
      );
      const result = await this.model.generateContentStream(prompt);

      let fullAnswer = '';

      // Stream chunks to client
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullAnswer += chunkText;

        // Send chunk to client
        res.write(
          `data: ${JSON.stringify({
            type: 'chunk',
            content: chunkText,
          })}\n\n`,
        );
      }

      // Save complete AI response to database
      const assistantMessage = await this.databaseService.chatMessage.create({
        data: {
          role: 'assistant',
          content: fullAnswer,
          sessionId: chatSession.id,
        },
      });

      // Send completion signal
      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          messageId: assistantMessage.id,
        })}\n\n`,
      );

      this.logger.log(
        `Streaming chat completed for session: ${chatSession.id}`,
      );

      res.end();
    } catch (error: unknown) {
      this.logger.error('Error in streaming tutor chat:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: errorMessage,
        })}\n\n`,
      );
      res.end();
    }
  }

  /**
   * Get all chat sessions for a user
   */
  async getUserChatSessions(userId: string): Promise<unknown> {
    const sessions = await this.databaseService.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1, // Get first message for preview
        },
        note: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
    return sessions;
  }

  /**
   * Get a specific chat session with all messages
   */
  async getChatSession(sessionId: string, userId: string): Promise<unknown> {
    const session = await this.databaseService.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        note: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    return session;
  }

  /**
   * Delete a chat session
   */
  async deleteChatSession(sessionId: string, userId: string): Promise<unknown> {
    const session = await this.getChatSession(sessionId, userId);

    if (!session || typeof session !== 'object' || !('id' in session)) {
      throw new NotFoundException('Chat session not found');
    }

    const result = await this.databaseService.chatSession.delete({
      where: { id: session.id as string },
    });
    return result;
  }

  /**
   * Update chat session title
   */
  async updateChatSessionTitle(
    sessionId: string,
    userId: string,
    title: string,
  ): Promise<unknown> {
    const session = await this.getChatSession(sessionId, userId);

    if (!session || typeof session !== 'object' || !('id' in session)) {
      throw new NotFoundException('Chat session not found');
    }

    const result = await this.databaseService.chatSession.update({
      where: { id: session.id as string },
      data: { title },
    });
    return result;
  }
}
