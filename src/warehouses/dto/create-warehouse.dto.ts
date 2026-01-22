// src/warehouses/dto/create-warehouse.dto.ts
import { IsNotEmpty, IsString, IsOptional, MaxLength, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWarehouseDto {
  @ApiProperty({
    example: 'Bodega Central',
    description: 'Nombre único de la bodega',
  })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres' })
  nombre: string;

  @ApiProperty({
    example: 'Almacenamiento principal de herramientas y equipos',
    description: 'Descripción de la bodega',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  descripcion?: string;

  @ApiProperty({
    example: 'Calle 123 #45-67, Ciudad',
    description: 'Dirección física de la bodega',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La dirección debe ser una cadena de texto' })
  @MaxLength(200, { message: 'La dirección no puede exceder los 200 caracteres' })
  direccion?: string;

  // NUEVO: ID del cliente (opcional)
  @ApiProperty({
    example: 1,
    description: 'ID del cliente al que pertenece la bodega (opcional)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El clienteId debe ser un número' })
  clienteId?: number | null;
}