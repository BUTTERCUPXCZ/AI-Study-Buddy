export const NOTES_GENERATION_PROMPT = (pdfText: string): string => {
  return `Generate clear, well-structured exam study notes based on the following lecture material.

Requirements:
- Summarize only the most important concepts.
- Organize the notes with headings, bullet points, and short explanations.
- Highlight definitions, key terms, formulas, and examples.
- Keep the notes concise but complete.

Lecture Material:
${pdfText}

Create the study notes now.`;
};
