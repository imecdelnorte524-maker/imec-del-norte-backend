import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsNumber,
  ValidateNested,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TermsType } from '../../shared';

export class TermsAcceptanceDto {
  @ApiProperty({ enum: TermsType })
  @IsEnum(TermsType)
  termsType: TermsType;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  termsVersion: number;
}

export class CreateAtsDto {
  @IsString()
  workerName: string;

  @IsString()
  @IsOptional()
  workerIdentification?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  area?: string;

  @IsString()
  @IsOptional()
  subArea?: string;

  @IsString()
  @IsOptional()
  workToPerform?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  observations?: string;

  @ApiProperty({ description: 'IDs de riesgos seleccionados', type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  riskIds: number[];

  @ApiProperty({ description: 'IDs de EPP seleccionados', type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  ppeItemIds: number[];

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