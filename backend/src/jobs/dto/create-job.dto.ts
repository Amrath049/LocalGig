import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { JobType, PayType } from '../../common/enums';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(JobType)
  type!: JobType;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(PayType)
  payType?: PayType;

  @IsOptional()
  @IsNumber()
  payAmount?: number;

  @IsOptional()
  @IsNumber()
  payMin?: number;

  @IsOptional()
  @IsNumber()
  payMax?: number;

  @IsOptional()
  @IsString()
  payCustom?: string;
}
