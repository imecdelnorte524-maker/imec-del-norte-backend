import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CheckValue } from '../../shared/index';
import { TermsAcceptanceDto } from './create-ats.dto';

export class PreoperationalCheckDto {
  @ApiProperty({ example: 123 })
  @IsInt()
  @Min(1)
  parameterId: number;

  @ApiProperty({ enum: CheckValue, required: false })
  @IsEnum(CheckValue)
  @IsOptional()
  value?: CheckValue;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  observations?: string;
}

export class CreatePreoperationalDto {
  @ApiProperty({ description: 'ID de la plantilla activa/versionada que se usó', example: 10 })
  @IsInt()
  @Min(1)
  templateId: number;

  @IsString()
  @IsOptional()
  equipmentTool?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreoperationalCheckDto)
  checks: PreoperationalCheckDto[];

  @ApiProperty({ type: [TermsAcceptanceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TermsAcceptanceDto)
  termsAcceptances: TermsAcceptanceDto[];

  @IsNumber()
  userId: number;

  @IsNumber()
  createdBy: number;

  @IsNumber()
  workOrderId: number;
}