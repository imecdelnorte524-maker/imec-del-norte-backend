// src/sg-sst/dto/create-ats.dto.ts
import {
  IsString,
  IsOptional,
  IsObject,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAtsDto {
  @ApiProperty({ description: 'Nombre completo del trabajador', example: 'Juan Pérez García' })
  @IsString()
  workerName: string;

  @ApiProperty({ description: 'Cédula del trabajador', required: false, example: '123456789' })
  @IsString()
  @IsOptional()
  workerIdentification?: string;

  @ApiProperty({ description: 'Cargo del trabajador', required: false, example: 'Técnico Electricista' })
  @IsString()
  @IsOptional()
  position?: string;

  @ApiProperty({ description: 'ID del cliente', required: false, example: 1 })
  @IsNumber()
  @IsOptional()
  clientId?: number;

  @ApiProperty({ description: 'Nombre del cliente (para denormalización)', required: false, example: 'Empresa ABC S.A.' })
  @IsString()
  @IsOptional()
  clientName?: string;

  @ApiProperty({ description: 'NIT del cliente (para denormalización)', required: false, example: '900123456-7' })
  @IsString()
  @IsOptional()
  clientNit?: string;

  @ApiProperty({ description: 'Área de trabajo', required: false, example: 'Electricidad' })
  @IsString()
  @IsOptional()
  area?: string;

  @ApiProperty({ description: 'Sub-área de trabajo', required: false, example: 'Subestación eléctrica' })
  @IsString()
  @IsOptional()
  subArea?: string;

  @ApiProperty({ description: 'Descripción del trabajo a realizar', required: false, example: 'Instalación de sistema eléctrico' })
  @IsString()
  @IsOptional()
  workToPerform?: string;

  @ApiProperty({ description: 'Ubicación del trabajo', required: false, example: 'Edificio Principal - Piso 3' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ description: 'Hora de inicio del trabajo', required: false, example: '08:00' })
  @IsString()
  @IsOptional()
  startTime?: string;

  @ApiProperty({ description: 'Hora de finalización del trabajo', required: false, example: '17:00' })
  @IsString()
  @IsOptional()
  endTime?: string;

  @ApiProperty({ description: 'Fecha del trabajo', required: false, example: '2024-01-15' })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiProperty({ description: 'Observaciones adicionales', required: false, example: 'Trabajo en área confinada' })
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiProperty({
    description: 'Riesgos seleccionados en formato JSON',
    required: false,
    example: { fisicos: ['ruido'], quimicos: ['vapores'] },
  })
  @IsObject()
  @IsOptional()
  selectedRisks?: any;

  @ApiProperty({
    description: 'Equipos de protección personal requeridos',
    required: false,
    example: { cascos: 1, guantes: 2 },
  })
  @IsObject()
  @IsOptional()
  requiredPpe?: any;

  @ApiProperty({ description: 'ID del usuario que realiza el trabajo', example: 1 })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: 'ID del usuario que crea el formulario', example: 1 })
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