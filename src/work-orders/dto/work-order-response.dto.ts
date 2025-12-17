import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderStatus } from '../enums/work-order-status.enum';
import {
  ServiceCategory,
  WorkNature,
  MaintenanceType,
} from '../../services/enums/service.enums';

class ServiceInfo {
  @ApiProperty({ example: 1, description: 'ID del servicio' })
  servicioId: number;

  @ApiProperty({
    example: 'Instalación de Aires Acondicionados',
    description: 'Nombre del servicio',
  })
  nombreServicio: string;

  @ApiProperty({
    example: 150000.0,
    description: 'Precio base del servicio',
  })
  precioBase: number;

  @ApiProperty({
    example: 'Aires Acondicionados',
    description: 'Categoría del servicio (línea de negocio)',
    enum: ServiceCategory,
    required: false,
  })
  categoriaServicio?: ServiceCategory;

  @ApiProperty({
    example: 'Mantenimiento',
    description: 'Tipo de trabajo (Instalación, Mantenimiento, Construcción)',
    enum: WorkNature,
    required: false,
  })
  tipoTrabajo?: WorkNature;

  @ApiProperty({
    example: 'Preventivo',
    description:
      'Tipo de mantenimiento (Preventivo, Correctivo) cuando aplica',
    enum: MaintenanceType,
    required: false,
  })
  tipoMantenimiento?: MaintenanceType;
}

class UserInfo {
  @ApiProperty({ example: 1, description: 'ID del usuario' })
  usuarioId: number;

  @ApiProperty({ example: 'Juan', description: 'Nombre del usuario' })
  nombre: string;

  @ApiProperty({ example: 'Pérez', description: 'Apellido del usuario' })
  apellido: string;

  @ApiProperty({
    example: 'juan.perez@cliente.com',
    description: 'Email del usuario',
  })
  email: string;
}

class ClientCompanyInfo {
  @ApiProperty({ example: 5, description: 'ID del cliente empresa' })
  idCliente: number;

  @ApiProperty({
    example: 'Empresa XYZ',
    description: 'Nombre de la empresa',
  })
  nombre: string;

  @ApiProperty({ example: '900123456-7', description: 'NIT de la empresa' })
  nit: string;

  @ApiProperty({
    example: 'cliente@empresa.com',
    description: 'Email del cliente empresa',
  })
  email: string;

  @ApiProperty({
    example: '3001234567',
    description: 'Teléfono del cliente empresa',
  })
  telefono: string;

  @ApiProperty({
    example: 'Bogotá, Colombia',
    description: 'Localización del cliente empresa',
  })
  localizacion: string;
}

class EquipmentInfo {
  @ApiProperty({
    example: 10,
    description: 'ID del equipo (hoja de vida) asociado',
  })
  equipmentId: number;

  @ApiProperty({
    example: 'Aire acondicionado sala de juntas 1',
    description: 'Nombre del equipo',
  })
  name: string;

  @ApiProperty({
    example: 'AA-SJ-001',
    description: 'Código interno del equipo',
    required: false,
  })
  code?: string;

  @ApiProperty({
    example: 'Aires Acondicionados',
    description: 'Categoría del equipo',
    enum: ServiceCategory,
  })
  category: ServiceCategory;
}

class SupplyDetailInfo {
  @ApiProperty({ example: 1, description: 'ID del detalle de insumo' })
  detalleInsumoId: number;

  @ApiProperty({ example: 2.5, description: 'Cantidad usada' })
  cantidadUsada: number;

  @ApiProperty({ example: 15000.0, description: 'Costo unitario' })
  costoUnitarioAlMomento: number;

  @ApiProperty({
    example: 'Cables de Prueba',
    description: 'Nombre del insumo',
  })
  nombreInsumo: string;
}

class ToolDetailInfo {
  @ApiProperty({ example: 1, description: 'ID del detalle de herramienta' })
  detalleHerramientaId: number;

  @ApiProperty({
    example: '4 horas',
    description: 'Tiempo de uso',
  })
  tiempoUso: string;

  @ApiProperty({
    example: 'Multímetro Digital',
    description: 'Nombre de la herramienta',
  })
  nombreHerramienta: string;

  @ApiProperty({ example: 'Fluke', description: 'Marca de la herramienta' })
  marca: string;
}

export class WorkOrderResponseDto {
  @ApiProperty({ example: 1, description: 'ID de la orden de trabajo' })
  ordenId: number;

  @ApiProperty({ type: ServiceInfo, description: 'Información del servicio' })
  service: ServiceInfo;

  @ApiProperty({
    type: ClientCompanyInfo,
    description: 'Información del cliente empresa',
    required: false,
  })
  clienteEmpresa?: ClientCompanyInfo;

  @ApiProperty({ type: UserInfo, description: 'Información del cliente' })
  cliente: UserInfo;

  @ApiProperty({
    type: UserInfo,
    description: 'Información del técnico',
    required: false,
  })
  tecnico?: UserInfo;

  @ApiProperty({
    type: EquipmentInfo,
    description: 'Información del equipo asociado (hoja de vida)',
    required: false,
  })
  equipo?: EquipmentInfo;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de solicitud',
  })
  fechaSolicitud: Date;

  @ApiProperty({
    example: '2024-01-15T08:00:00.000Z',
    description: 'Fecha de inicio',
    required: false,
  })
  fechaInicio?: Date;

  @ApiProperty({
    example: '2024-01-15T12:00:00.000Z',
    description: 'Fecha de finalización',
    required: false,
  })
  fechaFinalizacion?: Date;

  @ApiProperty({
    example: 'En proceso',
    description: 'Estado de la orden',
    enum: WorkOrderStatus,
  })
  estado: WorkOrderStatus;

  @ApiProperty({
    example: 'Trabajo en progreso',
    description: 'Comentarios',
  })
  comentarios?: string;

  @ApiProperty({
    type: [SupplyDetailInfo],
    description: 'Detalles de insumos usados',
  })
  supplyDetails: SupplyDetailInfo[];

  @ApiProperty({
    type: [ToolDetailInfo],
    description: 'Detalles de equipos/herramientas asignados',
  })
  toolDetails: ToolDetailInfo[];

  @ApiProperty({
    example: 37500.0,
    description: 'Costo total de insumos',
  })
  costoTotalInsumos: number;

  @ApiProperty({
    example: 187500.0,
    description: 'Costo total estimado (servicio + insumos)',
  })
  costoTotalEstimado: number;
}