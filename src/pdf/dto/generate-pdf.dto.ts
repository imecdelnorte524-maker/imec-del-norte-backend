// src/pdf/dto/generate-pdf.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';
import { PdfTemplateType } from '../constants/wkhtmltopdf.config';

export class GeneratePdfDto {
  @ApiProperty({
    description: 'Nombre del template a usar',
    example: 'test',
    enum: ['test', 'payroll_discount'], // ← Ahora en minúsculas
  })
  @IsString()
  templateName: PdfTemplateType; // ← Usa el tipo directamente

  @ApiProperty({
    description: 'Parámetros para el template',
    example: { NAME: 'Josver Samuel' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  params?: Record<string, any>;
}