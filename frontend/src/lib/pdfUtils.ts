import { jsPDF } from 'jspdf';

/**
 * Cleans text by removing emojis and markdown formatting
 */
export const cleanText = (text: string): string => {
  return text
    // Remove emojis (surrogates and other ranges)
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}-\u{2454}\u{20D0}-\u{20FF}]/gu, '')
    // Remove markdown headings (# Title)
    .replace(/^#+\s+/gm, '')
    // Remove bold (**text**)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove italic (*text*)
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove code blocks (```)
    .replace(/```\w*\n?/g, '').replace(/```/g, '')
    // Remove inline code (`text`)
    .replace(/`([^`]+)`/g, '$1')
    // Remove links ([text](url))
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Remove images (![alt](url))
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
    // Remove blockquotes (>)
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules (---)
    .replace(/^---\s*$/gm, '')
    .trim();
};

/**
 * Generates and downloads a PDF for a note
 */
export const downloadNotePdf = (title: string, content: string): void => {
  const doc = new jsPDF();
  
  const cleanTitle = cleanText(title);
  const cleanContent = cleanText(content);
  
  // Add title
  doc.setFontSize(20);
  doc.text(cleanTitle, 20, 20);
  
  // Add content
  doc.setFontSize(12);
  
  // Split text to fit page width
  const splitText = doc.splitTextToSize(cleanContent, 170);
  
  let y = 40;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const lineHeight = 7;
  
  splitText.forEach((line: string) => {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  });
  
  doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
};
