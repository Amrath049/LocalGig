import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsEnum(['WORKER', 'EMPLOYER'])
  role: string;

  @ValidateIf((o) => o.role === 'WORKER')
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ValidateIf((o) => o.role === 'WORKER')
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @ValidateIf((o) => o.role === 'WORKER')
  @IsOptional()
  skillTags?: string[];

  @ValidateIf((o) => o.role === 'EMPLOYER')
  @IsString()
  @IsNotEmpty()
  businessName?: string;

  @ValidateIf((o) => o.role === 'EMPLOYER')
  @IsString()
  @IsNotEmpty()
  employerPhone?: string;
}
