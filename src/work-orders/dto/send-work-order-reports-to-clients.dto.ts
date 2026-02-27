import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class SendWorkOrderReportsToClientsDto {
  @ApiProperty({
    type: [Number],
    required: false,
    example: [101, 102],
    description:
      'Opcional: si se omite, se usarán todas las órdenes COMPLETED de la BD',
  })
  @IsOptional()
  @IsArray()
  orderIds?: number[];

  @ApiProperty({
    required: false,
    example: 'Adjuntamos los informes de las órdenes finalizadas.',
  })
  @IsOptional()
  @IsString()
  message?: string;
}
