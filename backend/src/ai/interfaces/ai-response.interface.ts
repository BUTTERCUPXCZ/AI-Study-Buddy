export interface QuizQuestion {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export interface GenerateNotesResponse {
  notes: string;
  success: boolean;
  error?: string;
}

export interface GenerateQuizResponse {
  questions: QuizQuestion[];
  success: boolean;
  error?: string;
}

export interface TutorChatResponse {
  answer: string;
  success: boolean;
  error?: string;
}
