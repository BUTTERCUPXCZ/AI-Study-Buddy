/**
 * Markdown Utility for Cleaning and Formatting AI-Generated Content
 * Produces clean, ChatGPT-style formatted notes with proper spacing and tables
 */

// Regex patterns
const CODE_FENCE_REGEX = /```[\w+-]*\n?[\s\S]*?```/g;
const BULLET_CHARS = /^(\s*)[•●◦▪‣·*+-]\s+/;
const MULTI_NEWLINES_REGEX = /\n{3,}/g;
const TABLE_ROW_REGEX = /^\|.+\|$/;

/**
 * Clean AI-generated markdown text
 * Removes code fences, normalizes spacing, and fixes formatting issues
 */
export function cleanAiMarkdown(text: string): string {
  if (!text) {
    return '';
  }

  // Normalize line endings
  let cleaned = text.replace(/\r\n/g, '\n').trim();

  if (!cleaned) {
    return '';
  }

  // Remove literal \n and \n\n that AI might output as text
  cleaned = cleaned.replace(/\\n\\n/g, '\n\n');
  cleaned = cleaned.replace(/\\n/g, '\n');

  // Remove markdown code blocks (```...```) but keep content
  cleaned = cleaned.replace(CODE_FENCE_REGEX, (block) => {
    const content = block
      .replace(/^```[\w+-]*\s*/, '')
      .replace(/```\s*$/, '')
      .trim();
    return content;
  });

  // Normalize bullet points to use standard dash
  const lines = cleaned.split('\n');
  const normalizedLines = lines.map((line) => {
    if (BULLET_CHARS.test(line)) {
      return line.replace(BULLET_CHARS, '$1- ');
    }
    return line;
  });

  cleaned = normalizedLines.join('\n');

  // Remove excessive blank lines (max 2 newlines = 1 blank line)
  cleaned = cleaned.replace(MULTI_NEWLINES_REGEX, '\n\n');

  // Fix table spacing - ensure no blank lines within tables
  cleaned = fixTableSpacing(cleaned);

  // Ensure proper spacing around headings
  cleaned = ensureHeadingSpacing(cleaned);

  // Final cleanup
  cleaned = cleaned.replace(MULTI_NEWLINES_REGEX, '\n\n').trim();

  return cleaned;
}

/**
 * Format notes markdown with proper structure
 * Ensures title, proper spacing, and clean table formatting
 */
export function formatNotesMarkdown(markdown: string): string {
  if (!markdown) {
    return '';
  }

  let cleaned = cleanAiMarkdown(markdown);

  // Ensure there's a main title
  const lines = cleaned.split('\n');
  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line.trim()));

  if (titleIndex === -1) {
    // No title found, add one
    const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
    const derivedTitle =
      firstContentIndex >= 0 ? lines[firstContentIndex].trim() : 'Study Notes';

    const title =
      derivedTitle
        .replace(/^#+\s+/, '')
        .replace(/^\*\*(.*)\*\*$/, '$1')
        .replace(/[:.]+$/, '')
        .trim() || 'Study Notes';

    if (firstContentIndex >= 0) {
      lines.splice(firstContentIndex, 1, `# ${title}`);
    } else {
      lines.unshift(`# ${title}`);
    }
  }

  cleaned = lines.join('\n');

  // Format all tables
  cleaned = formatTables(cleaned);

  // Final spacing cleanup
  cleaned = cleaned.replace(MULTI_NEWLINES_REGEX, '\n\n').trim();

  return cleaned;
}

/**
 * Fix spacing around tables to ensure clean formatting
 */
function fixTableSpacing(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableRow = TABLE_ROW_REGEX.test(line.trim());

    if (isTableRow) {
      // If starting a table, ensure one blank line before (unless at start)
      if (!inTable && result.length > 0 && result[result.length - 1] !== '') {
        result.push('');
      }
      result.push(line);
      inTable = true;
    } else if (inTable && !isTableRow) {
      // Ending table, ensure one blank line after
      if (line.trim() !== '') {
        result.push('');
      }
      result.push(line);
      inTable = false;
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Ensure proper spacing around headings
 */
function ensureHeadingSpacing(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = /^#{1,6}\s+/.test(line.trim());
    const prevLine = i > 0 ? lines[i - 1] : '';
    const nextLine = i < lines.length - 1 ? lines[i + 1] : '';

    if (isHeading) {
      // Ensure one blank line before heading (unless at start or after another heading)
      if (
        result.length > 0 &&
        prevLine.trim() !== '' &&
        !/^#{1,6}\s+/.test(prevLine.trim())
      ) {
        if (result[result.length - 1] !== '') {
          result.push('');
        }
      }

      result.push(line);

      // Ensure one blank line after heading if next line has content
      if (nextLine.trim() !== '' && !TABLE_ROW_REGEX.test(nextLine.trim())) {
        result.push('');
      }
    } else if (line.trim() === '') {
      // Only add blank line if previous line wasn't blank
      if (result.length > 0 && result[result.length - 1] !== '') {
        result.push('');
      }
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Format markdown tables for clean, consistent appearance
 */
function formatTables(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let tableBuffer: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const isTableRow = TABLE_ROW_REGEX.test(line.trim());

    if (isTableRow) {
      if (!inTable) {
        inTable = true;
        tableBuffer = [];
      }
      tableBuffer.push(line.trim());
    } else {
      if (inTable && tableBuffer.length > 0) {
        // Process and add complete table
        result.push(...formatTableRows(tableBuffer));
        tableBuffer = [];
        inTable = false;
      }
      result.push(line);
    }
  }

  // Handle table at end of document
  if (inTable && tableBuffer.length > 0) {
    result.push(...formatTableRows(tableBuffer));
  }

  return result.join('\n');
}

/**
 * Format individual table rows for consistency
 */
function formatTableRows(rows: string[]): string[] {
  if (rows.length === 0) {
    return [];
  }

  return rows.map((row) => {
    // Split by pipe, trim each cell, rejoin with proper spacing
    const cells = row.split('|').map((cell) => cell.trim());

    // Remove empty cells at start and end
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();

    // Rejoin with proper spacing
    return `| ${cells.join(' | ')} |`;
  });
}
