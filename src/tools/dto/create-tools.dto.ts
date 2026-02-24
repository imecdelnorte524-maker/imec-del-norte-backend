// src/tools/dto/create-tools.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ToolType, ToolStatus } from '../../shared/index';

export class CreateToolDto {
  @ApiProperty({
    example: 'Multímetro Digital',
    description: 'Nombre de la herramienta',
  })
  @IsNotEmpty({ message: 'El nombre de la herramienta es requerido' })
  @IsString({
    message: 'El nombre de la herramienta debe ser una cadena de texto',
  })
  nombre: string;

  @ApiProperty({
    example: 'Fluke',
    description: 'Marca de la herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La marca debe ser una cadena de texto' })
  marca?: string;

  @ApiProperty({
    example: 'FLK123456',
    description: 'Número de serie de la herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El serial debe ser una cadena de texto' })
  serial?: string;

  @ApiProperty({
    example: '87V',
    description: 'Modelo de la herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El modelo debe ser una cadena de texto' })
  modelo?: string;

  @ApiProperty({
    example: 'True RMS, 6000 counts',
    description: 'Características técnicas de la herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({
    message: 'Las características técnicas deben ser una cadena de texto',
  })
  caracteristicasTecnicas?: string;

  @ApiProperty({
    example: 'Equipo en buen estado, calibrado recientemente',
    description: 'Observaciones de la herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto' })
  observacion?: string;

  @ApiProperty({
    example: 'Instrumento',
    description: 'Tipo de herramienta',
    enum: ToolType,
  })
  @IsNotEmpty({ message: 'El tipo de herramienta es requerido' })
  @IsEnum(ToolType, { message: 'El tipo debe ser un valor válido' })
  tipo: ToolType;

  @ApiProperty({
    example: 'Disponible',
    description: 'Estado de la herramienta',
    enum: ToolStatus,
  })
  @IsNotEmpty({ message: 'El estado de la herramienta es requerido' })
  @IsEnum(ToolStatus, { message: 'El estado debe ser un valor válido' })
  estado: ToolStatus;

  @ApiProperty({
    example: 1200000.0,
    description: 'Valor unitario de la herramienta',
  })
  @IsNotEmpty({ message: 'El valor unitario es requerido' })
  @IsNumber({}, { message: 'El valor unitario debe ser un número' })
  @Min(0, { message: 'El valor unitario no puede ser negativo' })
  valorUnitario: number;

  @ApiProperty({
    example: 1,
    description: 'ID de la bodega donde se almacena',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID de la bodega debe ser un número' })
  bodegaId?: number;

  @ApiProperty({
    example: 'Estante 2A, Sección 1B',
    description: 'Ubicación detallada en la bodega',
    required: false,
    maxLength: 200,
  })
  @IsOptional()
  @IsString({ message: 'La ubicación debe ser una cadena de texto' })
  @MaxLength(200, { message: 'La ubicación no puede exceder 200 caracteres' })
  ubicacion?: string;
}
