import { IsNotEmpty, IsString, IsNumber, IsOptional, Min, IsUrl, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SupplyCategory, UnitOfMeasure, SupplyStatus } from '../../shared/enums/inventory.enum';

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
    description: 'Unidad de medida del insumo',
    enum: UnitOfMeasure,
  })
  @IsNotEmpty({ message: 'La unidad de medida es requerida' })
  @IsEnum(UnitOfMeasure, { message: 'La unidad de medida debe ser un valor válido' })
  unidadMedida: UnitOfMeasure;

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
    example: 'https://example.com/foto-insumo.jpg',
    description: 'URL de la foto del insumo',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La URL de la foto debe ser una cadena de texto' })
  fotoUrl?: string;

  // NUEVO: Campos para el inventario asociado
  @ApiProperty({
    example: 50,
    description: 'Cantidad inicial en inventario',
    default: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'La cantidad inicial debe ser un número' })
  @Min(0, { message: 'La cantidad inicial no puede ser negativa' })
  cantidadInicial?: number = 0; // VALOR POR DEFECTO AÑADIDO

  @ApiProperty({
    example: 'Almacén Principal - Estante A',
    description: 'Ubicación del insumo en inventario',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La ubicación debe ser una cadena de texto' })
  ubicacion?: string;
}