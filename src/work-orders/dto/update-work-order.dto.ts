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
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  tecnicoId?: number;

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
}
