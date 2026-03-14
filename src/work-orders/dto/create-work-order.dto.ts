import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingStatus } from '../../shared/index';
import { WorkOrderStatus } from '../../shared/index';
import { ServiceRequestType } from '../../shared/index';
import { CostStatus } from '../../shared/index';

export class CreateWorkOrderDto {
  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsNumber()
  servicioId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  clienteId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  tecnicoId?: number; // Para compatibilidad con version anterior

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  clienteEmpresaId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comentarios?: string;

  @ApiProperty({
    description: 'Tipo de servicio solicitado',
    enum: ServiceRequestType,
    required: false,
  })
  @IsOptional()
  @IsEnum(ServiceRequestType)
  tipoServicio?: ServiceRequestType;

  @ApiProperty({
    example: 1,
    description: 'ID del tipo de mantenimiento (si aplica)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  maintenanceTypeId?: number;

  @ApiProperty({
    example: [1, 2, 3],
    description: 'IDs de equipos asociados a esta orden',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(0)
  equipmentIds?: number[];

  @ApiProperty({
    example: [1, 2],
    description: 'IDs de técnicos asignados a esta orden',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(0)
  @ArrayMaxSize(5)
  technicianIds?: number[];

  @ApiProperty({
    example: 1,
    description: 'ID del técnico líder (debe estar en technicianIds)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  leaderTechnicianId?: number;

  @ApiPropertyOptional({
    description: 'Estado inicial de la orden',
    enum: WorkOrderStatus,
    default: WorkOrderStatus.REQUESTED_UNASSIGNED,
  })
  @IsOptional()
  @IsEnum(WorkOrderStatus)
  estado?: WorkOrderStatus;

  @ApiPropertyOptional({
    description: 'Estado de facturación - siempre null al crear',
    enum: BillingStatus,
    nullable: true,
    default: null,
  })
  @IsOptional()
  estadoFacturacion?: BillingStatus | null;

  @ApiPropertyOptional({
    description: 'Estado de Pago de la Factura - siempre null al crear',
    enum: CostStatus,
    nullable: true,
    default: null,
  })
  @IsOptional()
  estadoPago?: CostStatus | null;

  @ApiProperty({
    description: 'Indica si es una orden de emergencia',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @ApiPropertyOptional({
    description: 'Observación para pausa (solo si estado es PAUSED)',
    required: false,
  })
  @IsOptional()
  @IsString()
  pauseObservation?: string;
}
