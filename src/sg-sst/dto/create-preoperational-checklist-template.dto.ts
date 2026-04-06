import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PreoperationalParameterCategory } from '../../shared/index';

export class CreatePreoperationalChecklistParameterDto {
  @IsString()
  @IsOptional()
  parameterCode?: string;

  @IsString()
  parameter: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PreoperationalParameterCategory)
  category: PreoperationalParameterCategory;

  @IsBoolean()
  required: boolean;

  @IsBoolean()
  critical: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;
}

export class CreatePreoperationalChecklistTemplateDto {
  @IsString()
  toolType: string;

  @IsString()
  toolCategory: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedTime?: number;

  @IsString()
  @IsOptional()
  additionalInstructions?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiresTools?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePreoperationalChecklistParameterDto)
  parameters: CreatePreoperationalChecklistParameterDto[];
}