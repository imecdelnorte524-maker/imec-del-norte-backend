import { IsOptional, IsNumber, Min, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateInventoryDto {
  @ApiProperty({
    example: 15.5,
    description: 'Cantidad actual en inventario',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'La cantidad actual debe ser un número' })
  @Min(0, { message: 'La cantidad actual no puede ser negativa' })
  @Type(() => Number)
  cantidadActual?: number;

  @ApiProperty({
    example: 2,
    description: 'ID de la bodega (null para desasignar)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID de la bodega debe ser un número' })
  @Type(() => Number)
  bodegaId?: number | null;

  @ApiProperty({
    example: 'Almacén Principal - Estante A',
    description: 'Ubicación dentro de la bodega',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La ubicación debe ser una cadena de texto' })
  ubicacion?: string;
}
