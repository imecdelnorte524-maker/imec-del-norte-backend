// src/tools/dto/update-tools.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateToolDto } from './create-tools.dto';
import { IsOptional, IsEnum, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ToolType, ToolStatus } from '../../shared/enums/inventory.enum';

export class UpdateToolDto extends PartialType(CreateToolDto) {
  @ApiProperty({
    example: 'Multímetro Digital Actualizado',
    description: 'Nombre de la herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El nombre de la herramienta debe ser una cadena de texto' })
  nombre?: string;

  @ApiProperty({
    example: 'Fluke Professional',
    description: 'Marca de la herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La marca debe ser una cadena de texto' })
  marca?: string;

  @ApiProperty({
    example: 'FLK123456-UPD',
    description: 'Número de serie de la herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El serial debe ser una cadena de texto' })
  serial?: string;

  @ApiProperty({
    example: '87V Pro',
    description: 'Modelo de la herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El modelo debe ser una cadena de texto' })
  modelo?: string;

  @ApiProperty({
    example: 'True RMS, 6000 counts, con Bluetooth',
    description: 'Características técnicas de la herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Las características técnicas deben ser una cadena de texto' })
  caracteristicasTecnicas?: string;

  @ApiProperty({
    example: 'Equipo en excelente estado, recién calibrado',
    description: 'Observaciones de la herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto' })
  observacion?: string;

  @ApiProperty({
    example: 'Instrumento de Medición',
    description: 'Tipo de herramienta',
    required: false,
    enum: ToolType,
  })
  @IsOptional()
  @IsEnum(ToolType, { message: 'El tipo debe ser un valor válido' })
  tipo?: ToolType;

  @ApiProperty({
    example: 'En Mantenimiento',
    description: 'Estado de la herramienta',
    required: false,
    enum: ToolStatus,
  })
  @IsOptional()
  @IsEnum(ToolStatus, { message: 'El estado debe ser un valor válido' })
  estado?: ToolStatus;

  @ApiProperty({
    example: 1300000.00,
    description: 'Valor unitario de la herramienta',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El valor unitario debe ser un número' })
  valorUnitario?: number;

  @ApiProperty({
    example: 2,
    description: 'ID de la bodega',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID de la bodega debe ser un número' })
  bodegaId?: number;
}