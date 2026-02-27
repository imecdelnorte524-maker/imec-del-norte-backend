// src/services/dto/update-service.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceCategory } from '../../shared/index';

export class UpdateServiceDto extends PartialType(CreateServiceDto) {
  @ApiProperty({
    example: 'Instalación y Mantenimiento de Aires Acondicionados',
    description: 'Nombre del servicio',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El nombre del servicio debe ser una cadena de texto' })
  nombreServicio?: string;

  @ApiProperty({
    example: 'Instalación y mantenimiento profesional de sistemas de aire acondicionado',
    description: 'Descripción del servicio',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  descripcion?: string;

  @ApiProperty({
    example: '5-7 horas',
    description: 'Duración estimada del servicio',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La duración estimada debe ser una cadena de texto' })
  duracionEstimada?: string;

  @ApiProperty({
    example: ServiceCategory.REDES_ELECTRICAS,
    description: 'Categoría del servicio (línea de negocio)',
    enum: ServiceCategory,
    required: false,
  })
  @IsOptional()
  @IsEnum(ServiceCategory, {
    message: 'La categoría del servicio no es válida',
  })
  categoriaServicio?: ServiceCategory;
}