// src/supplies/dto/create-supply.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SupplyCategory, SupplyStatus } from '../../shared/enums/inventory.enum';

export class CreateSupplyDto {
  @ApiProperty({
    example: 'Cables de Prueba',
    description: 'Nombre del insumo',
  })
  @IsNotEmpty({ message: 'El nombre del insumo es requerido' })
  @IsString({ message: 'El nombre del insumo debe ser una cadena de texto' })
  nombre: string;

  @ApiProperty({
    example: 'Eléctricos',
    description: 'Categoría del insumo',
    enum: SupplyCategory,
  })
  @IsNotEmpty({ message: 'La categoría es requerida' })
  @IsEnum(SupplyCategory, { message: 'La categoría debe ser un valor válido' })
  categoria: SupplyCategory;

  @ApiProperty({
    example: 'Par',
    description: 'Nombre de la unidad de medida',
  })
  @IsNotEmpty({ message: 'La unidad de medida es requerida' })
  @IsString({ message: 'La unidad de medida debe ser una cadena de texto' })
  unidadMedida: string; // Ahora es string, se buscará/creará la entidad

  @ApiProperty({
    example: 'Disponible',
    description: 'Estado del insumo',
    default: SupplyStatus.DISPONIBLE,
    enum: SupplyStatus,
  })
  @IsOptional()
  @IsEnum(SupplyStatus, { message: 'El estado debe ser un valor válido' })
  estado?: SupplyStatus;

  @ApiProperty({
    example: 10,
    description: 'Stock mínimo del insumo',
    default: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El stock mínimo debe ser un número' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo' })
  stockMin?: number;

  @ApiProperty({
    example: 15000.00,
    description: 'Valor unitario del insumo',
  })
  @IsNotEmpty({ message: 'El valor unitario es requerido' })
  @IsNumber({}, { message: 'El valor unitario debe ser un número' })
  @Min(0, { message: 'El valor unitario no puede ser negativo' })
  valorUnitario: number;

  @ApiProperty({
    example: 50,
    description: 'Cantidad inicial en inventario',
    default: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'La cantidad inicial debe ser un número' })
  @Min(0, { message: 'La cantidad inicial no puede ser negativa' })
  cantidadInicial?: number = 0;

  @ApiProperty({
    example: 1,
    description: 'ID de la bodega donde se almacena',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID de la bodega debe ser un número' })
  bodegaId?: number;
}