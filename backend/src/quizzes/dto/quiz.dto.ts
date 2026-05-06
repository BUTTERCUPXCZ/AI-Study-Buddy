import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
} from 'class-validator';

export class CreateQuizDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsArray()
  @IsNotEmpty()
  questions: any[];

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
