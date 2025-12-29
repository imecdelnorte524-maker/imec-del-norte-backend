import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingStatus } from '../enums/billing-status.enum';
import { WorkOrderStatus } from '../enums/work-order-status.enum';

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

  @ApiPropertyOptional({ 
    description: 'Estado inicial de la orden',
    enum: WorkOrderStatus,
    default: WorkOrderStatus.REQUESTED_UNASSIGNED 
  })
  @IsOptional()
  @IsEnum(WorkOrderStatus)
  estado?: WorkOrderStatus;

  @ApiPropertyOptional({ 
    description: 'Estado de facturación',
    enum: BillingStatus,
    default: BillingStatus.NOT_BILLED 
  })
  @IsOptional()
  @IsEnum(BillingStatus)
  estadoFacturacion?: BillingStatus;

}