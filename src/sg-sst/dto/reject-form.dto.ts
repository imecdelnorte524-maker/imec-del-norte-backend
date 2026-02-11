import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectFormDto {
  @ApiProperty({ description: 'ID del usuario que rechaza', example: 5 })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: 'Nombre del usuario que rechaza', example: 'Ana SST' })
  @IsString()
  userName: string;

  @ApiProperty({
    description: 'Motivo del rechazo',
    required: false,
    example: 'Información incompleta en la sección de riesgos',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}