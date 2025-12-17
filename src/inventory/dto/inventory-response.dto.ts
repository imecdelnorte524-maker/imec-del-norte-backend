import { ApiProperty } from '@nestjs/swagger';

class SupplyInfo {
  @ApiProperty({ example: 1, description: 'ID del insumo' })
  insumoId: number;

  @ApiProperty({ example: 'Cables de Prueba', description: 'Nombre del insumo' })
  nombre: string;

  @ApiProperty({ example: 'Eléctricos', description: 'Categoría del insumo' })
  categoria: string;

  @ApiProperty({ example: 'Par', description: 'Unidad de medida' })
  unidadMedida: string;

  @ApiProperty({ example: 'http://example.com/foto.jpg', description: 'URL de la foto del insumo' })
  fotoUrl: string;

  @ApiProperty({ example: 10, description: 'Stock mínimo' })
  stockMin: number;

  @ApiProperty({ example: 'Disponible', description: 'Estado del insumo' })
  estado: string;

  @ApiProperty({ example: 15000, description: 'Valor unitario' })
  valorUnitario: number;
}

class ToolInfo {
  @ApiProperty({ example: 1, description: 'ID del herramienta' })
  herramientaId: number;

  @ApiProperty({ example: 'Multímetro Digital', description: 'Nombre del herramienta' })
  nombre: string;

  @ApiProperty({ example: 'Fluke', description: 'Marca del herramienta' })
  marca: string;

  @ApiProperty({ example: 'FLK123456', description: 'Serial del herramienta' })
  serial: string;

  @ApiProperty({ example: '87V', description: 'Modelo del herramienta' })
  modelo: string;

  @ApiProperty({ example: 'http://example.com/foto.jpg', description: 'URL de la foto del herramienta' })
  fotoUrl: string;

  @ApiProperty({ example: 'Disponible', description: 'Estado del herramienta' })
  estado: string;

  @ApiProperty({ example: 1200000, description: 'Valor unitario' })
  valorUnitario: number;
}

export class InventoryResponseDto {
  @ApiProperty({ example: 1, description: 'ID del registro de inventario' })
  inventarioId: number;

  @ApiProperty({ 
    example: 10.5, 
    description: 'Cantidad actual en inventario' 
  })
  cantidadActual: number;

  @ApiProperty({ 
    example: 'Almacén Principal - Estante A', 
    description: 'Ubicación del item' 
  })
  ubicacion: string;

  @ApiProperty({ 
    example: '2024-01-01T00:00:00.000Z', 
    description: 'Fecha de última actualización' 
  })
  fechaUltimaActualizacion: Date;

  @ApiProperty({ 
    example: 'insumo', 
    description: 'Tipo de item (insumo o herramienta)' 
  })
  tipo: string;

  @ApiProperty({ 
    example: 'Cables de Prueba', 
    description: 'Nombre del item' 
  })
  nombreItem: string;

  @ApiProperty({ 
    type: SupplyInfo, 
    description: 'Información del insumo',
    required: false 
  })
  supply?: SupplyInfo;

  @ApiProperty({ 
    type: ToolInfo, 
    description: 'Información del herramienta',
    required: false 
  })
  tool?: ToolInfo;
}