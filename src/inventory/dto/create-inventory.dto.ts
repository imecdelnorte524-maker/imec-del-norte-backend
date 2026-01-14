// src/inventory/dto/create-inventory.dto.ts
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateInventoryDto {
  @ApiProperty({
    example: 1,
    description: 'ID del insumo (debe ser null si se proporciona herramientaId)',
    required: false,
  })
  @ValidateIf((o) => !o.herramientaId)
  @IsNumber({}, { message: 'El ID del insumo debe ser un número' })
  @Min(1, { message: 'El ID del insumo debe ser mayor a 0' })
  @Type(() => Number)
  insumoId?: number;

  @ApiProperty({
    example: 1,
    description: 'ID de la herramienta (debe ser null si se proporciona insumoId)',
    required: false,
  })
  @ValidateIf((o) => !o.insumoId)
  @IsNumber({}, { message: 'El ID de la herramienta debe ser un número' })
  @Min(1, { message: 'El ID de la herramienta debe ser mayor a 0' })
  @Type(() => Number)
  herramientaId?: number;

  @ApiProperty({
    example: 10.5,
    description: 'Cantidad actual en inventario',
    default: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'La cantidad actual debe ser un número' })
  @Min(0, { message: 'La cantidad actual no puede ser negativa' })
  @Type(() => Number)
  cantidadActual?: number;

  @ApiProperty({
    example: 1,
    description: 'ID de la bodega donde se almacena',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID de la bodega debe ser un número' })
  @Min(1, { message: 'El ID de la bodega debe ser mayor a 0' })
  @Type(() => Number)
  bodegaId?: number;
}