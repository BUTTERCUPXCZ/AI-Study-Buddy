export class CreateAiNotesJobDto {
  extractedText: string;
  fileName: string;
  userId: string;
  fileId: string;
  pdfExtractJobId: string;
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
