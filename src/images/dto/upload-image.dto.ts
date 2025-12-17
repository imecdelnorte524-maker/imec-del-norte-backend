import { ApiProperty } from '@nestjs/swagger';

export class UploadImageSwaggerDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Archivo de imagen (jpg, png, webp). Máx 5MB',
  })
  file: any;
}
