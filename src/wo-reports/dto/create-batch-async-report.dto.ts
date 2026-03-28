import { IsArray, IsEmail, IsIn, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class CreateBatchAsyncReportDto {
  @IsArray()
  @ArrayMinSize(1)
  orderIds!: number[];

  @IsIn(['internal', 'client'])
  reportType!: 'internal' | 'client';

  @IsIn(['download', 'email'])
  action!: 'download' | 'email';

  @IsOptional()
  @IsEmail()
  toEmail?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ccEmails?: string[];
}