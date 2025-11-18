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
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }

      // Verify content type
      const contentType = response.headers.get('content-type');
      this.logger.log(`Content-Type: ${contentType}`);
      
      if (contentType && !contentType.includes('application/pdf') && !contentType.includes('application/octet-stream')) {
        this.logger.warn(`Unexpected content type: ${contentType}, but will try to parse as PDF`);
      }

      // Get the PDF as a buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      this.logger.log(`Downloaded ${buffer.length} bytes`);

      // Parse the PDF
      return await this.extractTextFromBuffer(buffer);
    } catch (error) {
      this.logger.error(`Error extracting text from URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract text from PDF buffer
   */
  static async extractTextFromBuffer(buffer: Buffer): Promise<{
    text: string;
    pageCount: number;
  }> {
    try {
      // Use require for CommonJS module (pdf-parse)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse');
      
      this.logger.log('Parsing PDF buffer...');
      const data = await pdfParse(buffer);
      
      this.logger.log(`Successfully parsed PDF: ${data.numpages} pages, ${data.text.length} characters`);
      
      return {
        text: data.text,
        pageCount: data.numpages,
      };
    } catch (error) {
      this.logger.error(`Error parsing PDF: ${error.message}`);
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
      const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

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
      this.logger.error(`Error downloading from Supabase: ${error.message}`);
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
   * Split text into chunks for processing
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
}
