export class CreateAiQuizJobDto {
  noteId: string;
  noteContent: string;
  noteTitle: string;
  userId: string;
  aiNotesJobId: string;
}

export class AiQuizJobResult {
  quizId: string;
  title: string;
  questionsCount: number;
  processingTime: number;
}
