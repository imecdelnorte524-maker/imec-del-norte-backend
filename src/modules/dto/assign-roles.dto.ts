import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional } from 'class-validator';

export class AssignRolesDto {
  @ApiPropertyOptional({
    description: 'IDs de roles a asignar al módulo (array vacío para desasignar todos)',
    example: [1, 2],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  roles?: number[];
}