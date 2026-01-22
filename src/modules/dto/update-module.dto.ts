import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateModuleDto } from './create-module.dto';
import { IsArray, IsNumber, IsOptional } from 'class-validator';

export class UpdateModuleDto extends PartialType(CreateModuleDto) {
  @ApiPropertyOptional({
    description: 'IDs de los roles que tienen acceso a este módulo',
    example: [1, 2],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  roles?: number[]; // Array de IDs de roles, para actualizar los roles asociados
}