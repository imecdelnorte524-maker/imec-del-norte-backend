// src/work-orders/dto/update-work-order.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateWorkOrderDto } from './create-work-order.dto';
import {
  IsOptional,
  IsNumber,
  IsDateString,
  IsString,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderStatus } from '../../shared/index';
import { BillingStatus } from '../../shared/index';
import { CostStatus } from '../../shared/index';

export class UpdateWorkOrderDto extends PartialType(CreateWorkOrderDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  tecnicoId?: number; // Para compatibilidad

  @ApiProperty({ enum: WorkOrderStatus, required: false })
  @IsOptional()
  @IsEnum(WorkOrderStatus)
  estado?: WorkOrderStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fechaInicio?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fechaFinalizacion?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comentarios?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pauseObservation?: string;

  @ApiProperty({
    description: 'Estado de facturación (solo Admin/Secretaria)',
    enum: BillingStatus,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(BillingStatus)
  estadoFacturacion?: BillingStatus | null;

  @ApiProperty({
    description: 'Estado de Pago facturación (solo Admin/Secretaria)',
    enum: BillingStatus,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(CostStatus)
  estadoPago?: CostStatus | null;

  @ApiProperty({
    example: [1, 2],
    description: 'IDs de técnicos (reemplaza todos)',
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
    description: 'ID del técnico líder',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  leaderTechnicianId?: number;

  @ApiProperty({
    description: 'Indica si es una orden de emergencia',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;
}
