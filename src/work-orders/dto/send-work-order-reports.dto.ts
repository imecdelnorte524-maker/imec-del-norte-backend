import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export enum WorkOrderReportType {
  INTERNAL = 'internal',
  CLIENT = 'client',
}

export class SendWorkOrderReportsDto {
  @ApiProperty({ type: [Number], example: [101, 102] })
  @IsArray()
  @ArrayNotEmpty()
  orderIds: number[];

  @ApiProperty({
    enum: WorkOrderReportType,
    example: WorkOrderReportType.INTERNAL,
  })
  @IsEnum(WorkOrderReportType)
  reportType: WorkOrderReportType;

  @ApiProperty({ example: 'destino@empresa.com' })
  @IsEmail()
  toEmail: string;

  @ApiProperty({
    required: false,
    type: [String],
    example: ['cc1@empresa.com'],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  ccEmails?: string[];

  @ApiProperty({
    required: false,
    example: 'Informes de órdenes de servicio',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({
    required: false,
    example: 'Adjuntamos los informes de las órdenes seleccionadas.',
  })
  @IsOptional()
  @IsString()
  message?: string;
}
