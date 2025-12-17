import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInventoryDto {
  @ApiProperty({
    example: 1,
    description: 'ID del insumo (debe ser null si se proporciona herraminetaId)',
    required: false,
  })
  @ValidateIf(o => !o.herramientaId)
  @IsNumber({}, { message: 'El ID del insumo debe ser un número' })
  @Min(1, { message: 'El ID del insumo debe ser mayor a 0' })
  insumoId?: number;

  @ApiProperty({
    example: 1,
    description: 'ID del herramienta (debe ser null si se proporciona insumoId)',
    required: false,
  })
  @ValidateIf(o => !o.insumoId)
  @IsNumber({}, { message: 'El ID del herramienta debe ser un número' })
  @Min(1, { message: 'El ID del herramienta debe ser mayor a 0' })
  herramientaId?: number;

  @ApiProperty({
    example: 10.5,
    description: 'Cantidad actual en inventario',
    default: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'La cantidad actual debe ser un número' })
  @Min(0, { message: 'La cantidad actual no puede ser negativa' })
  cantidadActual?: number;

  @ApiProperty({
    example: 'Almacén Principal - Estante A',
    description: 'Ubicación del item en el inventario',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La ubicación debe ser una cadena de texto' })
  ubicacion?: string;
}