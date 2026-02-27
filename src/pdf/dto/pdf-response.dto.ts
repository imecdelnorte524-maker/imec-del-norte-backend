// src/pdf/dto/pdf-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class PdfResponseDto {
  @ApiProperty({ description: 'Buffer del PDF en base64' })
  data: string;

  @ApiProperty({ description: 'Tipo de contenido', example: 'application/pdf' })
  contentType: string;

  @ApiProperty({ description: 'Nombre del archivo', example: 'documento.pdf' })
  filename: string;
}