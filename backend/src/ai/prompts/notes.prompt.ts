export const NOTES_GENERATION_PROMPT = (pdfText: string): string => {
  return `You are an expert study assistant. Generate comprehensive, well-structured study notes from the following lecture material. 

Your notes should be:
- Clear, concise, and easy to understand
- Well-organized with proper sections and subsections
- Focused on key concepts and important details
- Include relevant examples where applicable
- Highlight important terms, definitions, and formulas
- Use bullet points and numbered lists for better readability

Format your response in a structured way with:
1. A brief overview/introduction
2. Main topics/sections with detailed explanations
3. Key points and takeaways for each section
4. Important terms and definitions
5. Examples or use cases where relevant

Lecture Material:
${pdfText}

Generate the study notes now:`;
};
