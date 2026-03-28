import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateClientsAsyncReportDto {
  @IsOptional()
  @IsArray()
  orderIds?: number[];

  @IsOptional()
  @IsString()
  message?: string;
}