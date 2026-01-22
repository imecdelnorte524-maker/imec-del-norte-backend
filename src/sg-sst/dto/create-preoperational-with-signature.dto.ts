// src/sg-sst/dto/create-preoperational-with-signature.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CheckValue } from '../entities/preoperational-check.entity';
import { ApiProperty } from '@nestjs/swagger';
import { SignerType } from './sign-form.dto';

export class PreoperationalCheckWithSignatureDto {
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

export class CreatePreoperationalWithSignatureDto {
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
    type: [PreoperationalCheckWithSignatureDto],
    example: [
      { parameter: 'Estado general', value: 'GOOD', observations: 'En buen estado' },
      { parameter: 'Fisuras', value: 'BAD', observations: 'Presenta fisuras' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreoperationalCheckWithSignatureDto)
  checks: PreoperationalCheckWithSignatureDto[];

  @ApiProperty({ description: 'ID del usuario técnico', example: 3 })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: 'ID del usuario creador', example: 1 })
  @IsNumber()
  createdBy: number;

  @ApiProperty({
    description: 'Firma del trabajador en formato base64',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  @IsString()
  signatureData: string;

  @ApiProperty({
    description: 'Tipo de firmante',
    enum: SignerType,
    example: SignerType.TECHNICIAN,
  })
  @IsEnum(SignerType)
  signerType: SignerType;

  @ApiProperty({ description: 'Nombre del firmante', example: 'Juan Técnico' })
  @IsString()
  userName: string;

  @ApiProperty({
    description: 'ID de la orden de trabajo asociada',
    example: 5,
  })
  @IsNumber()
  workOrderId: number;
}