export const TUTOR_PROMPT = (
  userQuestion: string,
  context?: string,
): string => {
  if (context && context.trim()) {
    return `You are a helpful study tutor. Use the following learning materials as context to answer the student's question. Base your explanation on the provided materials.

Learning Materials:
${context}

Student's Question:
${userQuestion}

Provide a clear and simple explanation based on the learning materials above.`;
  } else {
    return `You are a helpful AI study tutor powered by Google Gemini. Answer the student's question using your knowledge. Provide clear, accurate, and educational explanations.

Student's Question:
${userQuestion}

Provide a comprehensive and helpful explanation.`;
  }
};
