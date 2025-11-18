export class CreatePdfExtractJobDto {
  fileId: string;
  fileUrl: string;
  fileName: string;
  userId: string;
}

export class PdfExtractJobResult {
  fileId: string;
  extractedText: string;
  pageCount: number;
  fileName: string;
  processingTime: number;
}

export class JobStatusDto {
  jobId: string;
  status: string;
  progress?: number;
  data?: any;
  error?: string;
}
