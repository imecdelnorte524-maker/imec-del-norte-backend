import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceCategory, WorkNature, MaintenanceType } from '../enums/service.enums';

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
    example: 150000.0,
    description: 'Precio base del servicio',
    default: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El precio base debe ser un número' })
  @Min(0, { message: 'El precio base no puede ser negativo' })
  precioBase?: number;

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
    example: MaintenanceType.PREVENTIVO,
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