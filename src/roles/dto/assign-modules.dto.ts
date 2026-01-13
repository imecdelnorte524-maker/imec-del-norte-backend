import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional } from 'class-validator';

export class AssignModulesDto {
  @ApiPropertyOptional({
    description: 'IDs de módulos a asignar al rol (array vacío para desasignar todos)',
    example: [1, 2],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  moduloIds?: number[];
}