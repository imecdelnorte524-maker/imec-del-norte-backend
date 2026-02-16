// src/work-orders/dto/sign-work-order.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SignWorkOrderDto {
  @ApiProperty({
    example: 'Carlos Pérez',
    description: 'Nombre de quien recibe el servicio',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Jefe de Mantenimiento',
    description: 'Cargo de quien recibe el servicio',
  })
  @IsString()
  @IsNotEmpty()
  position: string;

  @ApiProperty({
    example: 'data:image/png;base64,iVBORw0KGgo...',
    description: 'Firma en base64 (imagen)',
  })
  @IsString()
  @IsNotEmpty()
  signatureData: string;
}
