import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingStatus } from '../enums/billing-status.enum';
import { WorkOrderStatus } from '../enums/work-order-status.enum';
import { ServiceRequestType } from '../enums/service-request-type.enum';

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
  tecnicoId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  clienteEmpresaId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fechaInicio?: Date;

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

  @ApiPropertyOptional({
    description: 'Estado inicial de la orden',
    enum: WorkOrderStatus,
    default: WorkOrderStatus.REQUESTED_UNASSIGNED,
  })
  @IsOptional()
  @IsEnum(WorkOrderStatus)
  estado?: WorkOrderStatus;

  @ApiPropertyOptional({
    description: 'Estado de facturación',
    enum: BillingStatus,
    default: BillingStatus.NOT_BILLED,
  })
  @IsOptional()
  @IsEnum(BillingStatus)
  estadoFacturacion?: BillingStatus;
}