// src/services/dto/service-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { ServiceCategory } from '../enums/service.enums';

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
    example: 'Instalación profesional de sistemas de aire acondicionado',
    description: 'Descripción del servicio',
  })
  descripcion?: string;

  @ApiProperty({
    example: '4-6 horas',
    description: 'Duración estimada del servicio',
  })
  duracionEstimada?: string;

  @ApiProperty({
    example: 'Aires Acondicionados',
    description: 'Categoría del servicio (línea de negocio)',
    enum: ServiceCategory,
  })
  categoriaServicio: ServiceCategory;
}