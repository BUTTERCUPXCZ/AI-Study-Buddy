import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePdfDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsOptional()
  fileType?: string;
}

export class UploadPdfResponseDto {
  id: string;
  url: string;
  name: string;
  userId: string;
  message: string;
  jobId?: string;
  optimizedJobId?: string;
  ultraOptimizedJobId?: string;
  deduplicated?: boolean;
}
