import { PartialType } from '@nestjs/swagger';
import { CreateWorkOrderDto } from './create-work-order.dto';
import {
  IsOptional,
  IsNumber,
  IsDateString,
  IsString,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderStatus } from '../enums/work-order-status.enum';

export class UpdateWorkOrderDto extends PartialType(CreateWorkOrderDto) {
  @ApiProperty({
    example: 4,
    description: 'ID del técnico asignado',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID del técnico debe ser un número' })
  tecnicoId?: number;

  @ApiProperty({
    example: WorkOrderStatus.IN_PROGRESS,
    description:
      'Estado de la orden de trabajo (Solicitada sin asignar, Solicitada asignada, En proceso, Finalizada, Cancelada)',
    required: false,
    enum: WorkOrderStatus,
  })
  @IsOptional()
  @IsEnum(WorkOrderStatus, { message: 'El estado de la orden no es válido' })
  estado?: WorkOrderStatus;

  @ApiProperty({
    example: '2024-01-15T08:00:00.000Z',
    description: 'Fecha de inicio real',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio debe ser una fecha válida' })
  fechaInicio?: Date;

  @ApiProperty({
    example: '2024-01-15T12:00:00.000Z',
    description: 'Fecha de finalización',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, {
    message: 'La fecha de finalización debe ser una fecha válida',
  })
  fechaFinalizacion?: Date;

  @ApiProperty({
    example: 'Trabajo completado satisfactoriamente',
    description: 'Comentarios adicionales',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Los comentarios deben ser una cadena de texto' })
  comentarios?: string;
}