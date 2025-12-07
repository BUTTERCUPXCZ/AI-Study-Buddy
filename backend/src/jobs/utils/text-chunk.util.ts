import { Logger } from '@nestjs/common';

/**
 * Text Chunking Utility - Intelligently splits text for parallel LLM processing
 * Uses semantic boundaries (paragraphs, sentences) instead of hard character limits
 */
export class TextChunkUtil {
  private static readonly logger = new Logger('TextChunkUtil');

  /**
   * Chunk text semantically for parallel processing
   * Aims for ~4000 chars per chunk but respects paragraph boundaries
   *
   * @param text - The full text to chunk
   * @param targetChunkSize - Target size in characters (default: 4000)
   * @param maxChunks - Maximum number of chunks (default: 5)
   * @returns Array of text chunks
   */
  static semanticChunk(
    text: string,
    targetChunkSize: number = 4000,
    maxChunks: number = 5,
  ): string[] {
    // Clean the text first
    const cleanedText = this.cleanText(text);

    // If text is small enough, return as single chunk
    if (cleanedText.length <= targetChunkSize) {
      this.logger.log('Text small enough for single chunk');
      return [cleanedText];
    }

    // Split into paragraphs (double newline or more)
    const paragraphs = cleanedText
      .split(/\n\s*\n+/)
      .filter((p) => p.trim().length > 0);

    this.logger.log(
      `Splitting ${cleanedText.length} chars across ${paragraphs.length} paragraphs`,
    );

    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const testChunk = currentChunk
        ? `${currentChunk}\n\n${paragraph}`
        : paragraph;

      // If adding this paragraph would exceed target size
      if (testChunk.length > targetChunkSize && currentChunk) {
        // Save current chunk
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;

        // Stop if we've reached max chunks
        if (chunks.length >= maxChunks - 1) {
          // Put remaining paragraphs in final chunk
          const remaining = paragraphs
            .slice(paragraphs.indexOf(paragraph))
            .join('\n\n');
          chunks.push(remaining.trim());
          break;
        }
      } else {
        currentChunk = testChunk;
      }
    }

    // Add final chunk if any
    if (currentChunk && chunks.length < maxChunks) {
      chunks.push(currentChunk.trim());
    }

    this.logger.log(
      `Created ${chunks.length} chunks: ${chunks.map((c) => c.length).join(', ')} chars`,
    );

    return chunks;
  }

  /**
   * Create chunks with overlap for better context continuity
   * Each chunk overlaps with previous by ~10%
   */
  static overlapChunk(
    text: string,
    chunkSize: number = 4000,
    overlapSize: number = 400,
  ): string[] {
    const cleanedText = this.cleanText(text);

    if (cleanedText.length <= chunkSize) {
      return [cleanedText];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < cleanedText.length) {
      const end = Math.min(start + chunkSize, cleanedText.length);
      const chunk = cleanedText.substring(start, end);
      chunks.push(chunk);

      // Move forward by (chunkSize - overlapSize)
      start += chunkSize - overlapSize;

      // Break if we're done
      if (end >= cleanedText.length) break;
    }

    this.logger.log(
      `Created ${chunks.length} overlapping chunks (overlap: ${overlapSize} chars)`,
    );

    return chunks;
  }

  /**
   * Merge chunked results intelligently
   * Removes duplicate headers and combines content
   */
  static mergeChunkedNotes(chunkResults: string[]): string {
    if (chunkResults.length === 0) return '';
    if (chunkResults.length === 1) return chunkResults[0];

    this.logger.log(`Merging ${chunkResults.length} chunk results`);

    // Extract title from first chunk
    const titleMatch = chunkResults[0].match(/^#\s+(.+?)$/m);
    const title = titleMatch ? titleMatch[1] : 'Study Notes';

    // Collect all sections from all chunks
    const allSections: { [key: string]: string[] } = {};

    for (const chunk of chunkResults) {
      // Split by ## headers
      const sections = chunk.split(/^##\s+/m);

      for (let i = 1; i < sections.length; i++) {
        const lines = sections[i].split('\n');
        const sectionTitle = lines[0].trim();
        const sectionContent = lines.slice(1).join('\n').trim();

        if (!allSections[sectionTitle]) {
          allSections[sectionTitle] = [];
        }

        if (sectionContent) {
          allSections[sectionTitle].push(sectionContent);
        }
      }
    }

    // Rebuild the document with deduplication
    let merged = `# ${title}\n\n`;

    // Priority order for sections
    const sectionOrder = [
      'Overview',
      '📘 Overview',
      'Key Concepts',
      '🎯 Key Concepts',
      'Detailed Notes',
      '📝 Detailed Notes',
      'Must-Know Points',
      '💡 Must-Know Points',
      'Key Terms & Definitions',
      '🔑 Key Terms & Definitions',
      'Summary',
      '📚 Summary',
    ];

    // Add sections in priority order
    for (const sectionName of sectionOrder) {
      if (allSections[sectionName]) {
        merged += `## ${sectionName}\n\n`;

        // Deduplicate and combine content
        const uniqueContent = [...new Set(allSections[sectionName])];
        merged += uniqueContent.join('\n\n') + '\n\n';

        delete allSections[sectionName];
      }
    }

    // Add any remaining sections
    for (const [sectionName, contents] of Object.entries(allSections)) {
      merged += `## ${sectionName}\n\n`;
      const uniqueContent = [...new Set(contents)];
      merged += uniqueContent.join('\n\n') + '\n\n';
    }

    this.logger.log(`Merged into ${merged.length} chars`);
    return merged.trim();
  }

  /**
   * Clean text - remove extra whitespace, normalize line breaks
   */
  private static cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\t/g, '  ') // Replace tabs
      .replace(/ +/g, ' ') // Multiple spaces to single
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .trim();
  }

  /**
   * Estimate tokens for OpenAI/Gemini
   * Rough estimate: 1 token ≈ 4 characters
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if text should be chunked based on token count
   */
  static shouldChunk(text: string, maxTokens: number = 4000): boolean {
    const estimatedTokens = this.estimateTokens(text);
    return estimatedTokens > maxTokens;
  }
}
