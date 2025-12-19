import { ApiProperty } from '@nestjs/swagger';

export class ToolResponseDto {
  @ApiProperty({
    example: 1,
    description: 'ID del herramienta',
  })
  herramientaId: number;

  @ApiProperty({
    example: 'Multímetro Digital',
    description: 'Nombre del herramienta',
  })
  nombre: string;

  @ApiProperty({
    example: 'Fluke',
    description: 'Marca del herramienta',
  })
  marca: string;

  @ApiProperty({
    example: 'FLK123456',
    description: 'Número de serie del herramienta',
  })
  serial: string;

  @ApiProperty({
    example: '87V',
    description: 'Modelo del herramienta',
  })
  modelo: string;

  @ApiProperty({
    example: 'True RMS, 6000 counts',
    description: 'Características técnicas del herramienta',
  })
  caracteristicasTecnicas: string;

  @ApiProperty({
    example: 'Equipo en buen estado',
    description: 'Observaciones del herramienta',
  })
  observacion: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de registro del herramienta',
  })
  fechaRegistro: Date;

  @ApiProperty({
    example: 'Instrumento',
    description: 'Tipo de herramienta',
  })
  tipo: string;

  @ApiProperty({
    example: 'Disponible',
    description: 'Estado del herramienta',
  })
  estado: string;

  @ApiProperty({
    example: 1200000.00,
    description: 'Valor unitario del herramienta',
  })
  valorUnitario: number;

  // NUEVO: Información del inventario
  @ApiProperty({
    example: 'Almacén Principal - Estante A',
    description: 'Ubicación en inventario',
  })
  ubicacion: string;

  @ApiProperty({
    example: 1,
    description: 'Cantidad en inventario (siempre 1 para equipos)',
  })
  cantidadActual: number;

  @ApiProperty({
    example: 1,
    description: 'ID del registro en inventario',
  })
  inventarioId?: number;
}