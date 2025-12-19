import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderStatus } from '../enums/work-order-status.enum';
import {
  ServiceCategory,
  WorkNature,
  MaintenanceType,
} from '../../services/enums/service.enums';
import { BillingStatus } from '../enums/billing-status.enum';

class ServiceInfo {
  @ApiProperty({ example: 1 })
  servicioId: number;

  @ApiProperty({ example: 'Instalación de Aires Acondicionados' })
  nombreServicio: string;

  @ApiProperty({ example: 150000 })
  precioBase: number;

  @ApiProperty({ enum: ServiceCategory, required: false })
  categoriaServicio?: ServiceCategory;

  @ApiProperty({ enum: WorkNature, required: false })
  tipoTrabajo?: WorkNature;

  @ApiProperty({ enum: MaintenanceType, required: false })
  tipoMantenimiento?: MaintenanceType;
}

class UserInfo {
  @ApiProperty({ example: 1 })
  usuarioId: number;

  @ApiProperty({ example: 'Juan' })
  nombre: string;

  @ApiProperty({ example: 'Pérez' })
  apellido: string;

  @ApiProperty({ example: 'juan.perez@correo.com' })
  email: string;
}

class ClientCompanyInfo {
  @ApiProperty({ example: 5 })
  idCliente: number;

  @ApiProperty({ example: 'Empresa XYZ' })
  nombre: string;

  @ApiProperty({ example: '900123456-7' })
  nit: string;

  @ApiProperty({ example: 'empresa@correo.com' })
  email: string;

  @ApiProperty({ example: '3001234567' })
  telefono: string;

  @ApiProperty({ example: 'Bogotá, Colombia' })
  localizacion: string;
}

class EquipmentInfo {
  @ApiProperty({ example: 10 })
  equipmentId: number;

  @ApiProperty({ example: 'Aire acondicionado sala juntas' })
  name: string;

  @ApiProperty({ example: 'AA-001', required: false })
  code?: string;

  @ApiProperty({ enum: ServiceCategory })
  category: ServiceCategory;
}

class SupplyDetailInfo {
  @ApiProperty({ example: 1 })
  detalleInsumoId: number;

  @ApiProperty({ example: 2 })
  cantidadUsada: number;

  @ApiProperty({ example: 15000 })
  costoUnitarioAlMomento: number;

  @ApiProperty({ example: 'Cable eléctrico' })
  nombreInsumo: string;
}

class ToolDetailInfo {
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

  @ApiProperty({ type: ClientCompanyInfo, required: false })
  clienteEmpresa?: ClientCompanyInfo;

  @ApiProperty({ type: UserInfo })
  cliente: UserInfo;

  @ApiProperty({ type: UserInfo, required: false })
  tecnico?: UserInfo;

  @ApiProperty({
    type: [EquipmentInfo],
    description: 'Equipos asociados a la orden',
  })
  equipos: EquipmentInfo[];

  @ApiProperty()
  fechaSolicitud: Date;

  @ApiProperty({ required: false })
  fechaInicio?: Date;

  @ApiProperty({ required: false })
  fechaFinalizacion?: Date;

  @ApiProperty({ enum: WorkOrderStatus })
  estado: WorkOrderStatus;

  @ApiProperty({ required: false })
  comentarios?: string;

  @ApiProperty({ type: [SupplyDetailInfo] })
  supplyDetails: SupplyDetailInfo[];

  @ApiProperty({ type: [ToolDetailInfo] })
  toolDetails: ToolDetailInfo[];

  @ApiProperty()
  costoTotalInsumos: number;

  @ApiProperty()
  costoTotalEstimado: number;

  @ApiProperty({ enum: BillingStatus })
  estadoFacturacion: BillingStatus;

  @ApiProperty({ required: false })
  facturaPdfUrl?: string;
}
