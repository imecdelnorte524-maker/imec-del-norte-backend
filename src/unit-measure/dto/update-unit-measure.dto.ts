
// src/unit-measure/dto/update-unit-measure.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateUnitMeasureDto } from './create-unit-measure.dto';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUnitMeasureDto extends PartialType(CreateUnitMeasureDto) {
  @ApiProperty({
    example: true,
    description: 'Estado de actividad de la unidad',
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'El estado activa debe ser un valor booleano' })
  activa?: boolean;
}