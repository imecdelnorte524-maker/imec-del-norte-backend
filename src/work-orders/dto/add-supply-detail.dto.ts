import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddSupplyDetailDto {
  @ApiProperty({
    example: 1,
    description: 'ID del insumo',
  })
  @IsNotEmpty({ message: 'El ID del insumo es requerido' })
  @IsNumber({}, { message: 'El ID del insumo debe ser un número' })
  insumoId: number;

  @ApiProperty({
    example: 2.5,
    description: 'Cantidad usada del insumo',
  })
  @IsNotEmpty({ message: 'La cantidad usada es requerida' })
  @IsNumber({}, { message: 'La cantidad usada debe ser un número' })
  @Min(0.1, { message: 'La cantidad usada debe ser mayor a 0' })
  cantidadUsada: number;

  @ApiProperty({
    example: 15000.00,
    description: 'Costo unitario al momento del uso',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El costo unitario debe ser un número' })
  @Min(0, { message: 'El costo unitario no puede ser negativo' })
  costoUnitarioAlMomento?: number;
}