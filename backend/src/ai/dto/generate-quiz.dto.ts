import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class GenerateQuizDto {
  @IsString()
  @IsNotEmpty()
  studyNotes: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  noteId?: string;
}

export class UpdateQuizScoreDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;
}
