import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderStatus } from '../enums/work-order-status.enum';
import { ServiceCategory } from '../../services/enums/service.enums';
import { BillingStatus } from '../enums/billing-status.enum';
import { ServiceRequestType } from '../enums/service-request-type.enum';

export class ServiceInfo {
  @ApiProperty({ example: 1 })
  servicioId: number;

  @ApiProperty({ example: 'Instalación de Aires Acondicionados' })
  nombreServicio: string;

  @ApiProperty({ enum: ServiceCategory, required: false, nullable: true })
  categoriaServicio?: ServiceCategory | null;
}

export class MaintenanceTypeInfo {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Preventivo' })
  nombre: string;
}

export class UserInfo {
  @ApiProperty({ example: 1 })
  usuarioId: number;

  @ApiProperty({ example: 'Juan' })
  nombre: string;

  @ApiProperty({ example: 'Pérez', required: false, nullable: true })
  apellido?: string | null;

  @ApiProperty({
    example: 'juan.perez@correo.com',
    required: false,
    nullable: true,
  })
  email?: string | null;

  @ApiProperty({ example: '3001234567', required: false, nullable: true })
  telefono?: string | null;

  @ApiProperty({ example: 54424415 })
  cedula?: string | null;
}

export class ClientCompanyInfo {
  @ApiProperty({ example: 5 })
  idCliente: number;

  @ApiProperty({ example: 'Empresa XYZ' })
  nombre: string;

  @ApiProperty({ example: '900123456-7' })
  nit: string;

  @ApiProperty({
    example: 'empresa@correo.com',
    required: false,
    nullable: true,
  })
  email?: string | null;

  @ApiProperty({ example: '3001234567', required: false, nullable: true })
  telefono?: string | null;

  @ApiProperty({ example: 'Bogotá, Colombia', required: false, nullable: true })
  localizacion?: string | null;
}

export class EquipmentInfo {
  @ApiProperty({ example: 10 })
  equipmentId: number;

  @ApiProperty({ example: 'AA-001', required: false })
  code?: string;

  @ApiProperty({ enum: ServiceCategory })
  category: ServiceCategory;

  @ApiProperty({
    example: 'Mantenimiento preventivo programado',
    required: false,
  })
  description?: string;
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

  @ApiProperty({ type: ClientCompanyInfo, required: false, nullable: true })
  clienteEmpresa?: ClientCompanyInfo | null;

  @ApiProperty({ type: UserInfo, required: false, nullable: true })
  cliente?: UserInfo | null;

  @ApiProperty({ type: UserInfo, required: false, nullable: true })
  tecnico?: UserInfo | null;

  @ApiProperty({ type: [EquipmentInfo], required: false })
  equipos: EquipmentInfo[];

  @ApiProperty({ required: false })
  fechaSolicitud?: Date;

  @ApiProperty({ required: false })
  fechaInicio?: Date;

  @ApiProperty({ required: false })
  fechaFinalizacion?: Date;

  @ApiProperty({ enum: WorkOrderStatus })
  estado: WorkOrderStatus;

  @ApiProperty({ enum: ServiceRequestType, required: false, nullable: true })
  tipoServicio?: ServiceRequestType | null;

  @ApiProperty({ type: MaintenanceTypeInfo, required: false, nullable: true })
  maintenanceType?: MaintenanceTypeInfo | null;

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
