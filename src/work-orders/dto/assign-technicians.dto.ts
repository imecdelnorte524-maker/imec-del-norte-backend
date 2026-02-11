// src/work-orders/dto/assign-technicians.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class AssignTechniciansDto {
  @ApiProperty({
    description: 'IDs de técnicos a asignar',
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsNumber({}, { each: true })
  technicianIds: number[];

  @ApiPropertyOptional({
    description: 'ID del técnico líder',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  leaderTechnicianId?: number;
}