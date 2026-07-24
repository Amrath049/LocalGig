import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string;

  @IsString()
  @IsEnum(['WORKER', 'EMPLOYER'])
  role: string;

  @ValidateIf((o) => o.role === 'WORKER')
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @ValidateIf((o) => o.role === 'WORKER')
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, { message: 'Phone number must be a valid 10-digit Indian number starting with 6-9' })
  phone?: string;

  @ValidateIf((o) => o.role === 'WORKER')
  @IsOptional()
  skillTags?: string[];

  @ValidateIf((o) => o.role === 'EMPLOYER')
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  businessName?: string;

  @ValidateIf((o) => o.role === 'EMPLOYER')
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, { message: 'Business phone number must be a valid 10-digit Indian number starting with 6-9' })
  employerPhone?: string;
}
