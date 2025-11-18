import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

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
