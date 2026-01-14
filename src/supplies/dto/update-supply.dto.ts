// src/supplies/dto/update-supply.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateSupplyDto } from './create-supply.dto';
import { IsOptional, IsString, IsNumber, Min, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SupplyCategory, SupplyStatus } from '../../shared/enums/inventory.enum';

export class UpdateSupplyDto extends PartialType(CreateSupplyDto) {
  @ApiProperty({
    example: 'Cables de Prueba Actualizados',
    description: 'Nombre del insumo',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El nombre del insumo debe ser una cadena de texto' })
  nombre?: string;

  @ApiProperty({
    example: 'Eléctricos',
    description: 'Categoría del insumo',
    enum: SupplyCategory,
    required: false,
  })
  @IsOptional()
  @IsEnum(SupplyCategory, { message: 'La categoría debe ser un valor válido' })
  categoria?: SupplyCategory;

  @ApiProperty({
    example: 'Par',
    description: 'Unidad de medida del insumo',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La unidad de medida debe ser una cadena de texto' })
  unidadMedida?: string;

  @ApiProperty({
    example: 'Disponible',
    description: 'Estado del insumo',
    default: SupplyStatus.DISPONIBLE,
    enum: SupplyStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(SupplyStatus, { message: 'El estado debe ser un valor válido' })
  estado?: SupplyStatus;

  @ApiProperty({
    example: 15,
    description: 'Stock mínimo del insumo',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El stock mínimo debe ser un número' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo' })
  stockMin?: number;

  @ApiProperty({
    example: 18000.00,
    description: 'Valor unitario del insumo',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El valor unitario debe ser un número' })
  @Min(0, { message: 'El valor unitario no puede ser negativo' })
  valorUnitario?: number;

  @ApiProperty({
    example: 75,
    description: 'Cantidad en inventario',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @Min(0, { message: 'La cantidad no puede ser negativa' })
  cantidadActual?: number;

  @ApiProperty({
    example: 2,
    description: 'ID de la bodega',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID de la bodega debe ser un número' })
  bodegaId?: number;
}