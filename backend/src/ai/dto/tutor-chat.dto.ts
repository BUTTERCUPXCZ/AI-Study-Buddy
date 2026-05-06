import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class TutorChatDto {
  @IsString()
  @IsNotEmpty()
  userQuestion: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  noteId?: string;
}

export class UpdateChatSessionTitleDto {
  @IsString()
  @IsNotEmpty()
  title: string;
}
