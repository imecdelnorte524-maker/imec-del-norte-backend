import { PartialType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto';
import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceCategory, WorkNature, MaintenanceType } from '../enums/service.enums';

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
    example:
      'Instalación y mantenimiento profesional de sistemas de aire acondicionado',
    description: 'Descripción del servicio',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  descripcion?: string;

  @ApiProperty({
    example: 200000.0,
    description: 'Precio base del servicio',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El precio base debe ser un número' })
  @Min(0, { message: 'El precio base no puede ser negativo' })
  precioBase?: number;

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

  @ApiProperty({
    example: WorkNature.MANTENIMIENTO,
    description:
      'Tipo de trabajo: Instalación, Mantenimiento o Construcción',
    enum: WorkNature,
    required: false,
  })
  @IsOptional()
  @IsEnum(WorkNature, {
    message: 'El tipo de trabajo no es válido',
  })
  tipoTrabajo?: WorkNature;

  @ApiProperty({
    example: MaintenanceType.CORRECTIVO,
    description:
      'Tipo de mantenimiento (solo aplica cuando el tipo de trabajo es Mantenimiento)',
    enum: MaintenanceType,
    required: false,
  })
  @IsOptional()
  @IsEnum(MaintenanceType, {
    message: 'El tipo de mantenimiento no es válido',
  })
  tipoMantenimiento?: MaintenanceType;
}