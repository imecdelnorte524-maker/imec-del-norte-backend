// src/images/dto/upload-header-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class UploadHeaderResponseDto {
  @ApiProperty({
    example:
      'https://res.cloudinary.com/dxne98os1/image/upload/v1740423517/pdf-templates/headers/header_imec.png',
    description: 'URL pública de la imagen en Cloudinary',
  })
  url: string;

  @ApiProperty({
    example: 'pdf-templates/headers/header_imec',
    description: 'Public ID en Cloudinary',
  })
  publicId: string;

  @ApiProperty({
    example: 'development',
    description: 'Ambiente actual (development/production)',
  })
  environment: string;

  @ApiProperty({
    example: 'header_imec.png',
    description: 'Nombre original del archivo',
  })
  originalName: string;
}
