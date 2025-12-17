import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({
    description: 'Nombre del rol',
    example: 'Técnico Senior',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  nombreRol?: string;

  @ApiPropertyOptional({
    description: 'Descripción del rol',
    example: 'Rol para técnicos con mayor experiencia',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  descripcion?: string;
}