export const TUTOR_PROMPT = (userQuestion: string, context: string): string => {
  return `You are a helpful study tutor. Use the following learning materials as context to answer the student's question. Base your explanation on the provided materials.

Learning Materials:
${context}

Student's Question:
${userQuestion}

Provide a clear and simple explanation based on the learning materials above.`;
};
