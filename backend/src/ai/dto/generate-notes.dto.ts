import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GenerateNotesDto {
  @IsString()
  @IsNotEmpty()
  pdfText: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  source?: string;
}

export class UpdateNoteDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  title?: string;
}
