import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TermsAcceptanceDto } from './create-ats.dto';

export class CreateHeightWorkDto {
  @IsString()
  workerName: string;

  @IsString()
  @IsOptional()
  identification?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  workDescription?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  estimatedTime?: string;

  @ApiProperty({ description: 'IDs de elementos de protección', type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  protectionElementIds: number[];

  @IsBoolean()
  physicalCondition: boolean;

  @IsBoolean()
  instructionsReceived: boolean;

  @IsBoolean()
  fitForHeightWork: boolean;

  @IsString()
  @IsOptional()
  authorizerName?: string;

  @IsString()
  @IsOptional()
  authorizerIdentification?: string;

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