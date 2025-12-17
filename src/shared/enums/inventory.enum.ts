// Estados de Equipos
export enum ToolStatus {
  DISPONIBLE = 'Disponible',
  EN_USO = 'En Uso',
  EN_MANTENIMIENTO = 'En Mantenimiento',
  DAÑADO = 'Dañado',
  RETIRADO = 'Retirado'
}

// Estados de Insumos
export enum SupplyStatus {
  DISPONIBLE = 'Disponible',
  AGOTADO = 'Agotado',
  STOCK_BAJO = 'Stock Bajo',
  INACTIVO = 'Inactivo'
}

// Tipos de Equipos
export enum ToolType {
  HERRAMIENTA = 'Herramienta',
  INSTRUMENTO = 'Instrumento',
  EQUIPO = 'Equipo',
  MAQUINARIA = 'Maquinaria',
  ELECTRONICO = 'Electrónico'
}

// Categorías de Insumos
export enum SupplyCategory {
  GENERAL = 'General',
  ELECTRICO = 'Eléctrico',
  MECANICO = 'Mecánico',
  PLOMERIA = 'Plomería',
  CARPINTERIA = 'Carpintería',
  ELECTRONICO = 'Electrónico',
  HERRRAJES = 'Herrajes'
}

// Unidades de Medida
export enum UnitOfMeasure {
  UNIDAD = 'Unidad',
  METRO = 'Metro',
  KILOGRAMO = 'Kilogramo',
  LITRO = 'Litro',
  CAJA = 'Caja',
  PAQUETE = 'Paquete',
  ROLLO = 'Rollo',
  PULGADA = 'Pulgada'
}

// Tipos de Items en Inventario
export enum InventoryItemType {
  INSUMO = 'insumo',
  EQUIPO = 'herramienta'
}