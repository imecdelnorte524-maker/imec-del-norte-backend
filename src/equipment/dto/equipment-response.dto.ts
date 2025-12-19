// src/equipment/dto/equipment-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

class ClientInfoDto {
  @ApiProperty({ example: 1 })
  idCliente: number;

  @ApiProperty({ example: 'IMEC DEL NORTE' })
  nombre: string;

  @ApiProperty({ example: '900123456-7' })
  nit: string;
}

class AreaInfoDto {
  @ApiProperty({ example: 10 })
  idArea: number;

  @ApiProperty({ example: 'Producción' })
  nombreArea: string;
}

class SubAreaInfoDto {
  @ApiProperty({ example: 5 })
  idSubArea: number;

  @ApiProperty({ example: 'Línea 1' })
  nombreSubArea: string;
}

class EquipmentPhotoDto {
  @ApiProperty({ example: 1 })
  photoId: number;

  @ApiProperty({ example: 12 })
  equipmentId: number;

  @ApiProperty({ example: 'https://...' })
  url: string;

  @ApiProperty({ required: false })
  description?: string | null;

  @ApiProperty()
  createdAt: string;
}

export class EquipmentResponseDto {
  @ApiProperty({ example: 12 })
  equipmentId: number;

  @ApiProperty()
  client: ClientInfoDto;

  @ApiProperty({ required: false })
  area?: AreaInfoDto;

  @ApiProperty({ required: false })
  subArea?: SubAreaInfoDto;

  @ApiProperty({
    example: 15,
    description: 'ID de la orden de servicio asociada',
    required: false,
  })
  orderId?: number | null;

  @ApiProperty()
  category: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  code?: string | null;

  @ApiProperty({ required: false })
  brand?: string | null;

  @ApiProperty({ required: false })
  model?: string | null;

  @ApiProperty({ required: false })
  serialNumber?: string | null;

  @ApiProperty({ required: false })
  capacity?: string | null;

  @ApiProperty({ required: false })
  refrigerantType?: string | null;

  @ApiProperty({ required: false })
  voltage?: string | null;

  @ApiProperty({ required: false })
  physicalLocation?: string | null;

  @ApiProperty({ required: false })
  manufacturer?: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  installationDate?: Date | null;

  @ApiProperty({ required: false })
  notes?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [EquipmentPhotoDto] })
  photos: EquipmentPhotoDto[];
}
