import { ApiProperty } from '@nestjs/swagger';

export class SupplyResponseDto {
  @ApiProperty({
    example: 1,
    description: 'ID del insumo',
  })
  insumoId: number;

  @ApiProperty({
    example: 'Cables de Prueba',
    description: 'Nombre del insumo',
  })
  nombre: string;

  @ApiProperty({
    example: 'Eléctricos',
    description: 'Categoría del insumo',
  })
  categoria: string;

  @ApiProperty({
    example: 'Par',
    description: 'Unidad de medida del insumo',
  })
  unidadMedida: string;

  // NUEVO: Stock desde inventario
  @ApiProperty({
    example: 50,
    description: 'Cantidad en inventario',
  })
  stock: number;

  @ApiProperty({
    example: 'Disponible',
    description: 'Estado del insumo',
  })
  estado: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de registro del insumo',
  })
  fechaRegistro: Date;

  @ApiProperty({
    example: 10,
    description: 'Stock mínimo del insumo',
  })
  stockMin: number;

  @ApiProperty({
    example: 15000.00,
    description: 'Valor unitario del insumo',
  })
  valorUnitario: number;

  // NUEVO: Información del inventario
  @ApiProperty({
    example: 'Almacén Principal - Estante A',
    description: 'Ubicación en inventario',
  })
  ubicacion: string;

  @ApiProperty({
    example: 50,
    description: 'Cantidad actual en inventario',
  })
  cantidadActual: number;

  @ApiProperty({
    example: 1,
    description: 'ID del registro en inventario',
  })
  inventarioId?: number;
}