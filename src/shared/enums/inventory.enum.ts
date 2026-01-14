// src/shared/enums/inventory.enum.ts
export enum ToolStatus {
  DISPONIBLE = 'Disponible',
  EN_USO = 'En Uso',
  EN_MANTENIMIENTO = 'En Mantenimiento',
  DAÑADO = 'Dañado',
  RETIRADO = 'Retirado'
}

export enum SupplyStatus {
  DISPONIBLE = 'Disponible',
  AGOTADO = 'Agotado',
  STOCK_BAJO = 'Stock Bajo',
  INACTIVO = 'Inactivo'
}

export enum ToolType {
  HERRAMIENTA = 'Herramienta',
  INSTRUMENTO = 'Instrumento',
  EQUIPO = 'Equipo',
  MAQUINARIA = 'Maquinaria',
  ELECTRONICO = 'Electrónico'
}

export enum SupplyCategory {
  GENERAL = 'General',
  ELECTRICO = 'Eléctrico',
  MECANICO = 'Mecánico',
  PLOMERIA = 'Plomería',
  CARPINTERIA = 'Carpintería',
  ELECTRONICO = 'Electrónico',
  HERRRAJES = 'Herrajes'
}

export enum InventoryItemType {
  INSUMO = 'insumo',
  EQUIPO = 'herramienta'
}

export enum ToolEliminationReason {
  DAÑADO = 'Dañado',
  ROBADO = 'Robado',
  OBSOLETO = 'Obsoleto',
  DONADO = 'Donado',
  VENDIDO = 'Vendido',
  PERDIDO = 'Perdido',
  RETIRADO = 'Retirado',
  OTRO = 'Otro'
}