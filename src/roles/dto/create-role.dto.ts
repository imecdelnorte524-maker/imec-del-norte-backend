import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Nombre del rol',
    example: 'Técnico',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombreRol: string;

  @ApiPropertyOptional({
    description: 'Descripción del rol',
    example: 'Rol para técnicos especializados',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  descripcion?: string;
}