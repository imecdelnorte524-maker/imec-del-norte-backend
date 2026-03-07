// src/sg-sst/dto/create-preoperational.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CheckValue } from '../../shared/index';

export class PreoperationalCheckDto {
  @ApiProperty({ description: 'Parámetro a verificar', example: 'Estado de bisagras' })
  @IsString()
  parameter: string;

  @ApiProperty({
    description: 'Valor de la verificación',
    enum: CheckValue,
    required: false,
    example: CheckValue.GOOD,
  })
  @IsEnum(CheckValue)
  @IsOptional()
  value?: CheckValue;

  @ApiProperty({
    description: 'Observaciones del parámetro',
    required: false,
    example: 'Bisagras en buen estado',
  })
  @IsString()
  @IsOptional()
  observations?: string;
}

export class CreatePreoperationalDto {
  @ApiProperty({
    description: 'Equipo o herramienta a verificar',
    required: false,
    example: 'Escalera extensible',
  })
  @IsString()
  @IsOptional()
  equipmentTool?: string;

  @ApiProperty({
    description: 'Lista de verificaciones preoperacionales',
    type: [PreoperationalCheckDto],
    example: [
      { parameter: 'Estado general', value: 'GOOD', observations: 'En buen estado' },
      { parameter: 'Fisuras', value: 'BAD', observations: 'Presenta fisuras' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreoperationalCheckDto)
  checks: PreoperationalCheckDto[];

  @ApiProperty({ description: 'ID del usuario técnico', example: 3 })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: 'ID del usuario creador', example: 1 })
  @IsNumber()
  createdBy: number;

  @ApiProperty({
    description: 'ID de la orden de trabajo asociada',
    example: 5,
  })
  @IsNumber()
  workOrderId: number;
}