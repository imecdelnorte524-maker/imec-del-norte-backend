// src/tools/dto/tools-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

class BodegaInfo {
  @ApiProperty({ example: 1, description: 'ID de la bodega' })
  bodegaId: number;

  @ApiProperty({ example: 'Bodega Central', description: 'Nombre de la bodega' })
  nombre: string;
}

export class ToolResponseDto {
  @ApiProperty({
    example: 1,
    description: 'ID de la herramienta',
  })
  herramientaId: number;

  @ApiProperty({
    example: 'Multímetro Digital',
    description: 'Nombre de la herramienta',
  })
  nombre: string;

  @ApiProperty({
    example: 'Fluke',
    description: 'Marca de la herramienta',
    required: false,
  })
  marca?: string;

  @ApiProperty({
    example: 'FLK123456',
    description: 'Número de serie de la herramienta',
    required: false,
  })
  serial?: string;

  @ApiProperty({
    example: '87V',
    description: 'Modelo de la herramienta',
    required: false,
  })
  modelo?: string;

  @ApiProperty({
    example: 'True RMS, 6000 counts',
    description: 'Características técnicas de la herramienta',
    required: false,
  })
  caracteristicasTecnicas?: string;

  @ApiProperty({
    example: 'Equipo en buen estado',
    description: 'Observaciones de la herramienta',
    required: false,
  })
  observacion?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de registro de la herramienta',
  })
  fechaRegistro: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de eliminación (si aplica)',
    required: false,
  })
  fechaEliminacion?: Date;

  @ApiProperty({
    example: 'Instrumento',
    description: 'Tipo de herramienta',
  })
  tipo: string;

  @ApiProperty({
    example: 'Disponible',
    description: 'Estado de la herramienta',
  })
  estado: string;

  @ApiProperty({
    example: 'Dañado',
    description: 'Motivo de eliminación (si aplica)',
    required: false,
  })
  motivoEliminacion?: string;

  @ApiProperty({
    example: 'Se cayó y se rompió la pantalla',
    description: 'Observación de eliminación',
    required: false,
  })
  observacionEliminacion?: string;

  @ApiProperty({
    example: 1200000.00,
    description: 'Valor unitario de la herramienta',
  })
  valorUnitario: number;

  @ApiProperty({
    type: BodegaInfo,
    description: 'Información de la bodega',
    required: false,
  })
  bodega?: BodegaInfo;

  @ApiProperty({
    example: 1,
    description: 'Cantidad en inventario (siempre 1 para herramientas)',
  })
  cantidadActual: number;

  @ApiProperty({
    example: 1,
    description: 'ID del registro en inventario',
  })
  inventarioId?: number;

  @ApiProperty({
    example: ['https://cloudinary.com/tool1.jpg', 'https://cloudinary.com/tool2.jpg'],
    description: 'URLs de las imágenes del carrusel',
    required: false,
  })
  imagenes?: string[];
}