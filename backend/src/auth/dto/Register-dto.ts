import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  Fullname: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;
}
