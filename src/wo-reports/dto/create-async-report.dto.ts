import { IsArray, IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateAsyncReportDto {
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