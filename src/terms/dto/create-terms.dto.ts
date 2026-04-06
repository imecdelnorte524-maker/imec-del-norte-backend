// src/dto/terms.dto.ts
import { IsEnum, IsString, IsArray, IsBoolean, IsOptional } from 'class-validator';
import { TermsType } from '../../shared';

export class CreateTermsDto {
  @IsEnum(TermsType)
  type: TermsType;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  items: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}