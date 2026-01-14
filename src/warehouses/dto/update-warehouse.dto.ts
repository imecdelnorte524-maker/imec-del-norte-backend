// src/warehouses/dto/update-warehouse.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateWarehouseDto } from './create-warehouse.dto';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {
  @ApiProperty({
    example: true,
    description: 'Estado de actividad de la bodega',
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'El estado activa debe ser un valor booleano' })
  activa?: boolean;
}