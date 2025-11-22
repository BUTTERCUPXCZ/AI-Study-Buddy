export const NOTES_GENERATION_PROMPT = (pdfText: string): string => {
  return `Create a exam study notes base on this Lecture Material:
${pdfText}  Generate the study notes now:`;
};
