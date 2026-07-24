import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  @IsEnum(['WORKER', 'EMPLOYER'])
  role?: string;
}
