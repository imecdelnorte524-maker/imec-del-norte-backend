import { ApiProperty } from '@nestjs/swagger';

class ClientInfoDto {
  @ApiProperty({ example: 1, description: 'ID del cliente empresa' })
  idCliente: number;

  @ApiProperty({ example: 'IMEC DEL NORTE', description: 'Nombre de la empresa' })
  nombre: string;

  @ApiProperty({ example: '900123456-7', description: 'NIT de la empresa' })
  nit: string;
}

class AreaInfoDto {
  @ApiProperty({ example: 10, description: 'ID del área' })
  idArea: number;

  @ApiProperty({ example: 'Producción', description: 'Nombre del área' })
  nombreArea: string;
}

class SubAreaInfoDto {
  @ApiProperty({ example: 5, description: 'ID de la subárea' })
  idSubArea: number;

  @ApiProperty({ example: 'Línea 1', description: 'Nombre de la subárea' })
  nombreSubArea: string;
}

class EquipmentPhotoDto {
  @ApiProperty({ example: 1, description: 'ID de la foto' })
  photoId: number;

  @ApiProperty({ example: 12, description: 'ID del equipo al que pertenece' })
  equipmentId: number;

  @ApiProperty({
    example: 'https://mi-servidor.com/fotos/equipo1.jpg',
    description: 'URL de la foto',
  })
  url: string;

  @ApiProperty({
    example: 'Unidad condensadora vista frontal',
    description: 'Descripción de la foto',
    required: false,
  })
  description?: string | null;

  @ApiProperty({
    example: '2025-01-10T14:30:00.000Z',
    description: 'Fecha de creación de la foto',
  })
  createdAt: Date;
}

export class EquipmentResponseDto {
  @ApiProperty({ example: 12, description: 'ID del equipo (hoja de vida)' })
  equipmentId: number;

  @ApiProperty({
    type: ClientInfoDto,
    description: 'Información del cliente (empresa) dueño del equipo',
  })
  client: ClientInfoDto;

  @ApiProperty({
    type: AreaInfoDto,
    required: false,
    description: 'Área a la que pertenece el equipo (opcional)',
  })
  area?: AreaInfoDto;

  @ApiProperty({
    type: SubAreaInfoDto,
    required: false,
    description: 'Subárea a la que pertenece el equipo (opcional)',
  })
  subArea?: SubAreaInfoDto;

  @ApiProperty({
    example: 'Aires Acondicionados',
    description: 'Categoría del equipo',
  })
  category: string;

  @ApiProperty({
    example: 'Aire acondicionado sala de juntas 1',
    description: 'Nombre del equipo',
  })
  name: string;

  @ApiProperty({
    example: 'AA-SJ-001',
    description: 'Código interno del equipo',
    required: false,
  })
  code?: string | null;

  @ApiProperty({
    example: 'LG',
    description: 'Marca del equipo',
    required: false,
  })
  brand?: string | null;

  @ApiProperty({
    example: 'Inverter 12000 BTU',
    description: 'Modelo del equipo',
    required: false,
  })
  model?: string | null;

  @ApiProperty({
    example: 'SN123456789',
    description: 'Número de serie',
    required: false,
  })
  serialNumber?: string | null;

  @ApiProperty({
    example: '12000 BTU',
    description: 'Capacidad del equipo',
    required: false,
  })
  capacity?: string | null;

  @ApiProperty({
    example: 'R410A',
    description: 'Tipo de refrigerante',
    required: false,
  })
  refrigerantType?: string | null;

  @ApiProperty({
    example: '220V',
    description: 'Voltaje del equipo',
    required: false,
  })
  voltage?: string | null;

  @ApiProperty({
    example: 'Sala de juntas 2º piso',
    description: 'Ubicación física detallada',
    required: false,
  })
  physicalLocation?: string | null;

  @ApiProperty({
    example: 'Samsung',
    description: 'Fabricante del equipo',
    required: false,
  })
  manufacturer?: string | null;

  @ApiProperty({
    example: 'Activo',
    description: 'Estado del equipo',
  })
  status: string;

  @ApiProperty({
    example: '2024-05-10T00:00:00.000Z',
    description: 'Fecha de instalación',
    required: false,
  })
  installationDate?: Date | null;

  @ApiProperty({
    example: 'Equipo instalado en 2024, requiere mantenimiento anual.',
    description: 'Observaciones / notas',
    required: false,
  })
  notes?: string | null;

  @ApiProperty({
    example: '2024-05-01T12:34:56.000Z',
    description: 'Fecha de creación del registro',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-05-20T09:30:00.000Z',
    description: 'Fecha de última actualización',
  })
  updatedAt: Date;

  @ApiProperty({
    type: [EquipmentPhotoDto],
    description: 'Fotos asociadas al equipo',
  })
  photos: EquipmentPhotoDto[];
}