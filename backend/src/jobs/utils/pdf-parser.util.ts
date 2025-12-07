import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '@nestjs/common';

export class PdfParserUtil {
  private static logger = new Logger('PdfParserUtil');

  /**
   * Download PDF from URL and extract text
   */
  static async extractTextFromUrl(url: string): Promise<{
    text: string;
    pageCount: number;
  }> {
    try {
      this.logger.log(`Fetching PDF from URL: ${url.substring(0, 100)}...`);

      // Fetch the PDF from the URL with proper headers
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'TaskFlow-PDF-Extractor/1.0',
        },
      });

      if (!response.ok) {
        this.logger.error(`HTTP ${response.status}: ${response.statusText}`);
        throw new Error(
          `Failed to fetch PDF: ${response.status} ${response.statusText}`,
        );
      }

      // Verify content type
      const contentType = response.headers.get('content-type');
      this.logger.log(`Content-Type: ${contentType}`);

      if (
        contentType &&
        !contentType.includes('application/pdf') &&
        !contentType.includes('application/octet-stream')
      ) {
        this.logger.warn(
          `Unexpected content type: ${contentType}, but will try to parse as PDF`,
        );
      }

      // Get the PDF as a buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      this.logger.log(`Downloaded ${buffer.length} bytes`);

      // Parse the PDF
      return await this.extractTextFromBuffer(buffer);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error extracting text from URL: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Extract text from PDF buffer
   * OPTIMIZED: Uses new pdf-parse v2.4.5+ API with PDFParse class
   */
  static async extractTextFromBuffer(buffer: Buffer): Promise<{
    text: string;
    pageCount: number;
  }> {
    try {
      this.logger.log('Parsing PDF buffer...');

      // Dynamic import - pdf-parse exports PDFParse as named export
      const { PDFParse } = await import('pdf-parse');

      // Create parser instance with the PDF data
      const parser = new PDFParse({
        data: new Uint8Array(buffer),
        verbosity: 0, // Silent mode for performance
      });

      // Extract text using getText() method
      const result = await parser.getText({
        // Optimize for speed
        lineEnforce: true,
        parseHyperlinks: false, // Skip hyperlinks for speed
        parsePageInfo: false, // Skip metadata for speed
        disableNormalization: false,
      });

      // Clean up
      await parser.destroy();

      this.logger.log(
        `Successfully parsed PDF: ${result.total} pages, ${result.text.length} characters`,
      );

      return {
        text: result.text,
        pageCount: result.total,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error parsing PDF: ${errorMessage}`, error);
      throw error;
    }
  }

  /**
   * Download PDF from Supabase storage
   */
  static async downloadFromSupabase(
    supabaseUrl: string,
    supabaseKey: string,
    bucketName: string,
    filePath: string,
  ): Promise<Buffer> {
    try {
      const supabase = createClient(
        supabaseUrl,
        supabaseKey,
      ) as unknown as SupabaseClient;

      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(filePath);

      if (error) {
        throw new Error(`Failed to download from Supabase: ${error.message}`);
      }

      // Convert blob to buffer
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error downloading from Supabase: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Clean and normalize extracted text
   */
  static cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n\n') // Normalize paragraph breaks
      .trim();
  }

  /**
   * Split text into chunks for processing (optimized for speed)
   */
  static chunkText(text: string, maxChunkSize: number = 4000): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Extract text with progress tracking (for large PDFs)
   * Returns a promise that resolves with text and page count
   */
  static async extractTextWithProgress(
    buffer: Buffer,
    onProgress?: (progress: number) => void,
  ): Promise<{
    text: string;
    pageCount: number;
  }> {
    try {
      if (onProgress) onProgress(10);

      const result = await this.extractTextFromBuffer(buffer);

      if (onProgress) onProgress(100);

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error in progressive extraction: ${errorMessage}`);
      throw error;
    }
  }
}
