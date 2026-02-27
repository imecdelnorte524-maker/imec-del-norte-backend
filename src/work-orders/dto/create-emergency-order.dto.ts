// src/work-orders/dto/create-emergency-order.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class CreateEmergencyOrderDto {
  @ApiProperty({
    description: 'IDs de técnicos asignados a la emergencia',
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  technicianIds: number[];

  @ApiPropertyOptional({
    description: 'ID del técnico líder',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  leaderTechnicianId?: number;

  @ApiProperty({
    description: 'IDs de equipos para la emergencia',
    example: [4, 5],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  equipmentIds: number[];

  @ApiPropertyOptional({
    description: 'Observaciones para la orden de emergencia',
    example: 'Falla crítica en sistema de refrigeración',
  })
  @IsOptional()
  @IsString()
  comentarios?: string;
}