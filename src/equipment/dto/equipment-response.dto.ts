import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EquipmentStatus } from '../enums/equipment-status.enum';

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

// --- Componentes ---

class MotorResponseDto {
  @ApiPropertyOptional({ example: '10A' })
  amperaje?: string;

  @ApiPropertyOptional({ example: '220V' })
  voltaje?: string;

  @ApiPropertyOptional({ example: '1500' })
  rpm?: string;

  @ApiPropertyOptional({ example: 'SN123456' })
  serialMotor?: string;

  @ApiPropertyOptional({ example: 'MTR-001' })
  modeloMotor?: string;

  @ApiPropertyOptional({ example: '12mm' })
  diametroEje?: string;

  @ApiPropertyOptional({ example: 'Redondo' })
  tipoEje?: string;
}

class EvaporatorResponseDto {
  @ApiPropertyOptional({ example: 'Samsung' })
  marca?: string;

  @ApiPropertyOptional({ example: 'AEV12' })
  modelo?: string;

  @ApiPropertyOptional({ example: 'EV123456' })
  serial?: string;

  @ApiPropertyOptional({ example: '12000 BTU' })
  capacidad?: string;

  @ApiPropertyOptional({ example: '8A' })
  amperaje?: string;

  @ApiPropertyOptional({ example: 'R410A' })
  tipoRefrigerante?: string;

  @ApiPropertyOptional({ example: '220V' })
  voltaje?: string;

  @ApiPropertyOptional({ example: '1' })
  numeroFases?: string;
}

class CondenserResponseDto {
  @ApiPropertyOptional({ example: 'Samsung' })
  marca?: string;

  @ApiPropertyOptional({ example: 'CNV12' })
  modelo?: string;

  @ApiPropertyOptional({ example: 'CN123456' })
  serial?: string;

  @ApiPropertyOptional({ example: '12000 BTU' })
  capacidad?: string;

  @ApiPropertyOptional({ example: '8A' })
  amperaje?: string;

  @ApiPropertyOptional({ example: '220V' })
  voltaje?: string;

  @ApiPropertyOptional({ example: 'R410A' })
  tipoRefrigerante?: string;

  @ApiPropertyOptional({ example: '1' })
  numeroFases?: string;

  @ApiPropertyOptional({ example: '150 PSI' })
  presionAlta?: string;

  @ApiPropertyOptional({ example: '50 PSI' })
  presionBaja?: string;

  @ApiPropertyOptional({ example: '2.5' })
  hp?: string;
}

class CompressorResponseDto {
  @ApiPropertyOptional({ example: 'Samsung' })
  marca?: string;

  @ApiPropertyOptional({ example: 'AEV12' })
  modelo?: string;

  @ApiPropertyOptional({ example: 'EV123456' })
  serial?: string;

  @ApiPropertyOptional({ example: '12000 BTU' })
  capacidad?: string;

  @ApiPropertyOptional({ example: '8A' })
  amperaje?: string;

  @ApiPropertyOptional({ example: 'R410A' })
  tipoRefrigerante?: string;

  @ApiPropertyOptional({ example: '220V' })
  voltaje?: string;

  @ApiPropertyOptional({ example: '1' })
  numeroFases?: string;

  @ApiPropertyOptional({ example: '15W' })
  tipoAceite?: string;

  @ApiPropertyOptional({ example: '15W' })
  cantidadAceite?: string;
}

// --- DTO principal ---

export class EquipmentResponseDto {
  @ApiProperty({ example: 12 })
  equipmentId: number;

  @ApiProperty()
  client: ClientInfoDto;

  @ApiPropertyOptional()
  area?: AreaInfoDto;

  @ApiPropertyOptional()
  subArea?: SubAreaInfoDto;

  @ApiPropertyOptional({
    example: 15,
    description: 'ID de la orden de servicio asociada',
  })
  workOrderId?: number | null;

  @ApiProperty()
  category: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID del tipo de aire acondicionado',
  })
  airConditionerTypeId?: number;

  @ApiPropertyOptional()
  airConditionerType?: {
    id: number;
    name: string;
    hasEvaporator: boolean;
    hasCondenser: boolean;
  };

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  code?: string | null;

  @ApiPropertyOptional()
  brand?: string | null;

  @ApiPropertyOptional()
  model?: string | null;

  @ApiPropertyOptional()
  serialNumber?: string | null;

  @ApiPropertyOptional()
  capacity?: string | null;

  @ApiPropertyOptional()
  refrigerantType?: string | null;

  @ApiPropertyOptional()
  voltage?: string | null;

  @ApiPropertyOptional()
  physicalLocation?: string | null;

  @ApiPropertyOptional()
  manufacturer?: string | null;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  installationDate?: Date | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [EquipmentPhotoDto] })
  photos: EquipmentPhotoDto[];

  // Componentes
  @ApiPropertyOptional({ type: MotorResponseDto })
  motor?: MotorResponseDto | null;

  @ApiPropertyOptional({ type: EvaporatorResponseDto })
  evaporator?: EvaporatorResponseDto | null;

  @ApiPropertyOptional({ type: CondenserResponseDto })
  condenser?: CondenserResponseDto | null;

  @ApiPropertyOptional({ type: CompressorResponseDto })
  compressor?: CompressorResponseDto | null;
}