// src/services/dto/create-service.dto.ts
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceCategory } from '../../shared/index';

export class CreateServiceDto {
  @ApiProperty({
    example: 'Instalación de Aires Acondicionados',
    description: 'Nombre del servicio',
  })
  @IsNotEmpty({ message: 'El nombre del servicio es requerido' })
  @IsString({ message: 'El nombre del servicio debe ser una cadena de texto' })
  nombreServicio: string;

  @ApiProperty({
    example: 'Instalación profesional de sistemas de aire acondicionado',
    description: 'Descripción del servicio',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  descripcion?: string;

  @ApiProperty({
    example: '4-6 horas',
    description: 'Duración estimada del servicio',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La duración estimada debe ser una cadena de texto' })
  duracionEstimada?: string;

  @ApiProperty({
    example: ServiceCategory.AIRES_ACONDICIONADOS,
    description: 'Categoría del servicio (línea de negocio)',
    enum: ServiceCategory,
    required: true, // ← ¡AHORA ES REQUERIDO!
  })
  @IsNotEmpty({ message: 'La categoría del servicio es requerida' })
  @IsEnum(ServiceCategory, {
    message: 'La categoría del servicio no es válida',
  })
  categoriaServicio: ServiceCategory;
}