// src/warehouses/dto/warehouse-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

class ClientSimpleDto {
  @ApiProperty({ example: 1, description: 'ID del cliente' })
  idCliente: number;

  @ApiProperty({ example: 'IMEC del Norte', description: 'Nombre del cliente' })
  nombre: string;

  @ApiProperty({ example: '900123456-7', description: 'NIT del cliente' })
  nit: string;
}

export class WarehouseResponseDto {
  @ApiProperty({ example: 1, description: 'ID de la bodega' })
  bodegaId: number;

  @ApiProperty({ example: 'Bodega Central', description: 'Nombre de la bodega' })
  nombre: string;

  @ApiProperty({
    example: 'Almacenamiento principal',
    description: 'Descripción de la bodega',
    required: false,
  })
  descripcion?: string;

  @ApiProperty({
    example: 'Calle 123 #45-67',
    description: 'Dirección física',
    required: false,
  })
  direccion?: string;

  @ApiProperty({ example: true, description: 'Estado de actividad' })
  activa: boolean;

  @ApiProperty({
    example: 1,
    description: 'ID del cliente al que pertenece',
    required: false,
    nullable: true,
  })
  clienteId?: number | null;

  @ApiProperty({
    type: () => ClientSimpleDto,
    description: 'Información del cliente',
    required: false,
    nullable: true,
  })
  cliente?: ClientSimpleDto | null;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de creación',
  })
  fechaCreacion: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de última actualización',
  })
  fechaActualizacion: Date;

  @ApiProperty({
    example: 5,
    description: 'Cantidad de items en inventario',
    required: false,
  })
  cantidadItems?: number;
}