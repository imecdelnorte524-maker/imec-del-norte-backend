// src/inventory/dto/inventory-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

class SupplyInfo {
  @ApiProperty({ example: 1, description: 'ID del insumo' })
  insumoId: number;

  @ApiProperty({
    example: 'Cables de Prueba',
    description: 'Nombre del insumo',
  })
  nombre: string;

  @ApiProperty({ example: 'Eléctricos', description: 'Categoría del insumo' })
  categoria: string;

  @ApiProperty({ example: 'Par', description: 'Unidad de medida' })
  unidadMedida: string;

  @ApiProperty({ example: 10, description: 'Stock mínimo' })
  stockMin: number;

  @ApiProperty({ example: 'Disponible', description: 'Estado del insumo' })
  estado: string;

  @ApiProperty({ example: 15000, description: 'Valor unitario' })
  valorUnitario: number;

  @ApiProperty({
    example: 'Cables para pruebas eléctricas',
    description: 'Descripción del insumo',
  })
  descripcion?: string;

  @ApiProperty({ example: 'ELEC-001', description: 'Código del insumo' })
  codigo?: string;
}

class ToolInfo {
  @ApiProperty({ example: 1, description: 'ID de la herramienta' })
  herramientaId: number;

  @ApiProperty({
    example: 'Multímetro Digital',
    description: 'Nombre de la herramienta',
  })
  nombre: string;

  @ApiProperty({ example: 'Fluke', description: 'Marca de la herramienta' })
  marca: string;

  @ApiProperty({
    example: 'FLK123456',
    description: 'Serial de la herramienta',
  })
  serial: string;

  @ApiProperty({ example: '87V', description: 'Modelo de la herramienta' })
  modelo: string;

  @ApiProperty({
    example: 'Disponible',
    description: 'Estado de la herramienta',
  })
  estado: string;

  @ApiProperty({ example: 1200000, description: 'Valor unitario' })
  valorUnitario: number;

  @ApiProperty({
    example: 'Multímetro digital profesional',
    description: 'Descripción de la herramienta',
  })
  descripcion?: string;

  @ApiProperty({ example: 'HERR-001', description: 'Código de la herramienta' })
  codigo?: string;

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
}

class BodegaInfo {
  @ApiProperty({ example: 1, description: 'ID de la bodega' })
  bodegaId: number;

  @ApiProperty({
    example: 'Bodega Central',
    description: 'Nombre de la bodega',
  })
  nombre: string;

  @ApiProperty({
    example: 'Almacenamiento principal',
    description: 'Descripción',
  })
  descripcion?: string;

  @ApiProperty({ example: 'Calle 123', description: 'Dirección física' })
  direccion?: string;

  @ApiProperty({ example: true, description: 'Estado de actividad' })
  activa: boolean;

  @ApiProperty({ example: 1, description: 'ID del cliente', required: false })
  clienteId?: number | null;

  @ApiProperty({
    example: 'IMEC del Norte',
    description: 'Nombre del cliente',
    required: false,
  })
  clienteNombre?: string;
}

export class InventoryResponseDto {
  @ApiProperty({ example: 1, description: 'ID del registro de inventario' })
  inventarioId: number;

  @ApiProperty({
    example: 10.5,
    description: 'Cantidad actual en inventario',
  })
  cantidadActual: number;

  @ApiProperty({
    example: 'Almacén Principal - Estante A',
    description: 'Ubicación del item',
    required: false,
  })
  ubicacion?: string;

  @ApiProperty({
    example: 'Stock Bajo',
    description: 'Estado del inventario',
    required: false,
  })
  estado?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de última actualización',
  })
  fechaUltimaActualizacion: Date;

  @ApiProperty({
    example: 'insumo',
    description: 'Tipo de item (insumo o herramienta)',
  })
  tipo: string;

  @ApiProperty({
    example: 'Cables de Prueba',
    description: 'Nombre del item',
  })
  nombreItem: string;

  @ApiProperty({
    example: 'Par',
    description: 'Unidad de medida del item',
  })
  unidadMedida: string;

  @ApiProperty({
    example: 15000,
    description: 'Valor unitario del item',
  })
  valorUnitario: number;

  @ApiProperty({
    example: 'Cables para pruebas eléctricas',
    description: 'Descripción del item',
    required: false,
  })
  descripcion?: string;

  @ApiProperty({
    example: 'ELEC-001',
    description: 'Código del item',
    required: false,
  })
  codigo?: string;

  @ApiProperty({
    type: BodegaInfo,
    description: 'Información de la bodega',
    required: false,
  })
  bodega?: BodegaInfo;

  @ApiProperty({
    type: SupplyInfo,
    description: 'Información del insumo',
    required: false,
  })
  supply?: SupplyInfo;

  @ApiProperty({
    type: ToolInfo,
    description: 'Información de la herramienta',
    required: false,
  })
  tool?: ToolInfo;
}
