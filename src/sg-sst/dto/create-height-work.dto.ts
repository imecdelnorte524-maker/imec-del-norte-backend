// src/sg-sst/dto/create-height-work.dto.ts
import { IsString, IsOptional, IsBoolean, IsNumber, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHeightWorkDto {
  @ApiProperty({ description: 'Nombre completo del trabajador', example: 'Carlos Rodríguez' })
  @IsString()
  workerName: string;

  @ApiProperty({ description: 'Número de identificación', required: false, example: '123456789' })
  @IsString()
  @IsOptional()
  identification?: string;

  @ApiProperty({ description: 'Cargo del trabajador', required: false, example: 'Técnico en Alturas' })
  @IsString()
  @IsOptional()
  position?: string;

  @ApiProperty({
    description: 'Descripción del trabajo en alturas',
    required: false,
    example: 'Mantenimiento de fachada',
  })
  @IsString()
  @IsOptional()
  workDescription?: string;

  @ApiProperty({
    description: 'Ubicación específica del trabajo',
    required: false,
    example: 'Fachada norte - Nivel 5',
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({
    description: 'Tiempo estimado para el trabajo',
    required: false,
    example: '4 horas',
  })
  @IsString()
  @IsOptional()
  estimatedTime?: string;

  @ApiProperty({
    description: 'Elementos de protección en formato JSON',
    required: false,
    example: { arnes: true, casco: true },
  })
  @IsObject()
  @IsOptional()
  protectionElements?: any;

  @ApiProperty({ description: 'Condiciones físicas aptas', required: false, example: true })
  @IsBoolean()
  @IsOptional()
  physicalCondition?: boolean;

  @ApiProperty({ description: 'Instrucciones recibidas', required: false, example: true })
  @IsBoolean()
  @IsOptional()
  instructionsReceived?: boolean;

  @ApiProperty({ description: 'Apto para trabajo en alturas', required: false, example: true })
  @IsBoolean()
  @IsOptional()
  fitForHeightWork?: boolean;

  @ApiProperty({
    description: 'Nombre del autorizador',
    required: false,
    example: 'María González',
  })
  @IsString()
  @IsOptional()
  authorizerName?: string;

  @ApiProperty({
    description: 'Identificación del autorizador',
    required: false,
    example: '987654321',
  })
  @IsString()
  @IsOptional()
  authorizerIdentification?: string;

  @ApiProperty({ description: 'ID del usuario trabajador', example: 2 })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: 'ID del usuario creador', example: 1 })
  @IsNumber()
  createdBy: number;

  @ApiProperty({
    description: 'Firma del trabajador en formato base64',
    required: false,
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  @IsString()
  @IsOptional()
  signatureData?: string;

  @ApiProperty({
    description: 'ID de la orden de trabajo asociada',
    example: 5,
  })
  @IsNumber()
  workOrderId: number;
}