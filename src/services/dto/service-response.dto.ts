import { ApiProperty } from '@nestjs/swagger';
import { ServiceCategory, WorkNature, MaintenanceType } from '../enums/service.enums';

export class ServiceResponseDto {
  @ApiProperty({
    example: 1,
    description: 'ID del servicio',
  })
  servicioId: number;

  @ApiProperty({
    example: 'Instalación de Aires Acondicionados',
    description: 'Nombre del servicio',
  })
  nombreServicio: string;

  @ApiProperty({
    example:
      'Instalación profesional de sistemas de aire acondicionado',
    description: 'Descripción del servicio',
  })
  descripcion: string;

  @ApiProperty({
    example: 150000.0,
    description: 'Precio base del servicio',
  })
  precioBase: number;

  @ApiProperty({
    example: '4-6 horas',
    description: 'Duración estimada del servicio',
  })
  duracionEstimada: string;

  @ApiProperty({
    example: 'Aires Acondicionados',
    description: 'Categoría del servicio (línea de negocio)',
    enum: ServiceCategory,
    required: false,
  })
  categoriaServicio?: ServiceCategory;

  @ApiProperty({
    example: 'Mantenimiento',
    description: 'Tipo de trabajo: Instalación, Mantenimiento o Construcción',
    enum: WorkNature,
    required: false,
  })
  tipoTrabajo?: WorkNature;

  @ApiProperty({
    example: 'Preventivo',
    description:
      'Tipo de mantenimiento (solo aplica cuando el tipo de trabajo es Mantenimiento)',
    enum: MaintenanceType,
    required: false,
  })
  tipoMantenimiento?: MaintenanceType;
}