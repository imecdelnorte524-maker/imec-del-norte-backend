// src/work-orders/dto/work-order-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderStatus } from '../enums/work-order-status.enum';
import {
  ServiceCategory,
  WorkNature,
  MaintenanceType,
} from '../../services/enums/service.enums';
import { BillingStatus } from '../enums/billing-status.enum';

export class ServiceInfo {
  @ApiProperty({ example: 1 })
  servicioId: number;

  @ApiProperty({ example: 'Instalación de Aires Acondicionados' })
  nombreServicio: string;

  @ApiProperty({ example: 150000 })
  precioBase: number;

  @ApiProperty({ enum: ServiceCategory, required: false, nullable: true })
  categoriaServicio?: ServiceCategory | null;

  @ApiProperty({ enum: WorkNature, required: false, nullable: true })
  tipoTrabajo?: WorkNature | null;

  @ApiProperty({ enum: MaintenanceType, required: false, nullable: true })
  tipoMantenimiento?: MaintenanceType | null;
}

export class UserInfo {
  @ApiProperty({ example: 1 })
  usuarioId: number;

  @ApiProperty({ example: 'Juan' })
  nombre: string;

  // Aceptamos nullable para coincidir con la entidad User
  @ApiProperty({ example: 'Pérez', required: false, nullable: true })
  apellido?: string | null;

  @ApiProperty({ example: 'juan.perez@correo.com', required: false, nullable: true })
  email?: string | null;

  @ApiProperty({ example: '3001234567', required: false, nullable: true })
  telefono?: string | null;
}

export class ClientCompanyInfo {
  @ApiProperty({ example: 5 })
  idCliente: number;

  @ApiProperty({ example: 'Empresa XYZ' })
  nombre: string;

  @ApiProperty({ example: '900123456-7' })
  nit: string;

  @ApiProperty({ example: 'empresa@correo.com', required: false, nullable: true })
  email?: string | null;

  @ApiProperty({ example: '3001234567', required: false, nullable: true })
  telefono?: string | null;

  @ApiProperty({ example: 'Bogotá, Colombia', required: false, nullable: true })
  localizacion?: string | null;
}

export class EquipmentInfo {
  @ApiProperty({ example: 10 })
  equipmentId: number;

  @ApiProperty({ example: 'Aire acondicionado sala juntas' })
  name: string;

  @ApiProperty({ example: 'AA-001', required: false })
  code?: string;

  @ApiProperty({ enum: ServiceCategory })
  category: ServiceCategory;
}

export class SupplyDetailInfo {
  @ApiProperty({ example: 1 })
  detalleInsumoId: number;

  @ApiProperty({ example: 2 })
  cantidadUsada: number;

  @ApiProperty({ example: 15000 })
  costoUnitarioAlMomento: number;

  @ApiProperty({ example: 'Cable eléctrico' })
  nombreInsumo: string;
}

export class ToolDetailInfo {
  @ApiProperty({ example: 1 })
  detalleHerramientaId: number;

  @ApiProperty({ example: '4 horas' })
  tiempoUso: string;

  @ApiProperty({ example: 'Taladro' })
  nombreHerramienta: string;

  @ApiProperty({ example: 'Bosch' })
  marca: string;
}

export class WorkOrderResponseDto {
  @ApiProperty({ example: 1 })
  ordenId: number;

  @ApiProperty({ type: ServiceInfo })
  service: ServiceInfo;

  // clienteEmpresa puede ser null si no aplica
  @ApiProperty({ type: ClientCompanyInfo, required: false, nullable: true })
  clienteEmpresa?: ClientCompanyInfo | null;

  // cliente ahora puede ser null (ajusta si lo quieres obligatorio)
  @ApiProperty({ type: UserInfo, required: false, nullable: true })
  cliente?: UserInfo | null;

  @ApiProperty({ type: UserInfo, required: false, nullable: true })
  tecnico?: UserInfo | null;

  @ApiProperty({
    type: [EquipmentInfo],
    description: 'Equipos asociados a la orden',
    required: false,
  })
  equipos: EquipmentInfo[];

  @ApiProperty({ required: false })
  fechaSolicitud?: Date;

  @ApiProperty({ required: false })
  fechaInicio?: Date;

  @ApiProperty({ required: false })
  fechaFinalizacion?: Date;

  @ApiProperty({ enum: WorkOrderStatus })
  estado: WorkOrderStatus;

  @ApiProperty({ required: false, nullable: true })
  comentarios?: string | null;

  @ApiProperty({ type: [SupplyDetailInfo], required: false })
  supplyDetails: SupplyDetailInfo[];

  @ApiProperty({ type: [ToolDetailInfo], required: false })
  toolDetails: ToolDetailInfo[];

  @ApiProperty()
  costoTotalInsumos: number;

  @ApiProperty()
  costoTotalEstimado: number;

  @ApiProperty({ enum: BillingStatus })
  estadoFacturacion: BillingStatus;

  @ApiProperty({ required: false, nullable: true })
  facturaPdfUrl?: string | null;
}