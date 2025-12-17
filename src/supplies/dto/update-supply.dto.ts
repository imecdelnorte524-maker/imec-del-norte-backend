import { PartialType } from '@nestjs/swagger';
import { CreateSupplyDto } from './create-supply.dto';
import { IsOptional, IsString, IsNumber, Min, IsUrl, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SupplyCategory, SupplyStatus, UnitOfMeasure } from '../../shared/enums/inventory.enum';

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
    enum: UnitOfMeasure,
    required: false,
  })
  @IsOptional()
  @IsEnum(UnitOfMeasure, { message: 'La unidad de medida debe ser un valor válido' })
  unidadMedida?: UnitOfMeasure;

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
    example: 'https://example.com/nueva-foto-insumo.jpg',
    description: 'URL de la foto del insumo',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La URL de la foto debe ser una cadena de texto' })
  fotoUrl?: string;

  // Campos para actualizar inventario
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
    example: 'Almacén Principal - Estante B',
    description: 'Ubicación en inventario',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La ubicación debe ser una cadena de texto' })
  ubicacion?: string;

  // Asegurar que cantidadInicial tenga valor por defecto
  cantidadInicial?: number = 0;
}