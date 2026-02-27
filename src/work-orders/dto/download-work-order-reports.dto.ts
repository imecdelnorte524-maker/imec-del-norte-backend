import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';
import { WorkOrderReportType } from './send-work-order-reports.dto';

export class DownloadWorkOrderReportsDto {
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
}
