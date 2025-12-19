import { PartialType } from '@nestjs/swagger';
import { CreateToolDto } from './create-tools.dto';
import { IsOptional, IsEnum, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ToolType, ToolStatus } from '../../shared/enums/inventory.enum';

export class UpdateToolDto extends PartialType(CreateToolDto) {
  @ApiProperty({
    example: 'Multímetro Digital Actualizado',
    description: 'Nombre del herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El nombre del herramienta debe ser una cadena de texto' })
  nombre?: string;

  @ApiProperty({
    example: 'Fluke Professional',
    description: 'Marca del herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La marca debe ser una cadena de texto' })
  marca?: string;

  @ApiProperty({
    example: 'FLK123456-UPD',
    description: 'Número de serie del herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El serial debe ser una cadena de texto' })
  serial?: string;

  @ApiProperty({
    example: '87V Pro',
    description: 'Modelo del herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El modelo debe ser una cadena de texto' })
  modelo?: string;

  @ApiProperty({
    example: 'True RMS, 6000 counts, con Bluetooth',
    description: 'Características técnicas del herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Las características técnicas deben ser una cadena de texto' })
  caracteristicasTecnicas?: string;

  @ApiProperty({
    example: 'Equipo en excelente estado, recién calibrado',
    description: 'Observaciones del herramienta',
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
    description: 'Estado del herramienta',
    required: false,
    enum: ToolStatus,
  })
  @IsOptional()
  @IsEnum(ToolStatus, { message: 'El estado debe ser un valor válido' })
  estado?: ToolStatus;

  @ApiProperty({
    example: 1300000.00,
    description: 'Valor unitario del herramienta',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El valor unitario debe ser un número' })
  valorUnitario?: number;
}