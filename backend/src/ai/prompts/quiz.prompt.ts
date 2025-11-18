export const QUIZ_GENERATION_PROMPT = (studyNotes: string): string => {
  return `Generate 20 multiple-choice questions based on this study content. Provide an answer per number so that the frontend would not call you everytime the frontend validates if it is the right answer or not.

Each question must include:
- question
- four options (labeled A, B, C, D)
- correct answer (the letter of the correct option)
- short explanation

Format your response as a JSON array with this structure:
[
  {
    "question": "Question text here?",
    "options": {
      "A": "Option A text",
      "B": "Option B text",
      "C": "Option C text",
      "D": "Option D text"
    },
    "correctAnswer": "A",
    "explanation": "Brief explanation of why this is correct"
  }
]

Content:
${studyNotes}`;
};
