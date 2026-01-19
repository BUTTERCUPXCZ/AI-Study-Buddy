export class CreateAiNotesJobDto {
  // Either extractedText OR pdfBuffer should be provided (pdfBuffer preferred for speed)
  extractedText?: string;
  pdfBuffer?: string; // Base64 encoded PDF buffer for direct Gemini processing
  fileName: string;
  userId: string;
  fileId: string;
  pdfExtractJobId?: string; // Optional - not needed for optimized queue
  mimeType?: string; // Default: 'application/pdf'
}

export class AiNotesJobResult {
  noteId: string;
  title: string;
  contentLength: number;
  processingTime: number;
  fileName: string;
}

export interface GeneratedNote {
  title: string;
  content: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
}
