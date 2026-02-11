import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EquipmentStatus } from '../enums/equipment-status.enum';
import { ServiceCategory } from '../../services/enums/service.enums';

// Sub-DTOs para respuesta (similares a los de creación pero con datos reales)

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

class WorkOrderInfoDto {
  @ApiProperty({ example: 15 })
  workOrderId: number;

  @ApiPropertyOptional({ example: 'Mantenimiento preventivo programado' })
  description?: string;

  @ApiProperty({ example: '2024-03-15T10:30:00Z' })
  createdAt: Date;

  @ApiPropertyOptional()
  workOrderDetails?: {
    estado?: string;
    tipoServicio?: string;
    fechaSolicitud?: Date;
  };
}

class EquipmentPhotoDto {
  @ApiProperty({ example: 1 })
  photoId: number;

  @ApiProperty({ example: 12 })
  equipmentId: number;

  @ApiProperty({ example: 'https://...' })
  url: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  createdAt: string;
}

class MotorResponseDto {
  @ApiPropertyOptional({ example: '8.5A' })
  amperaje?: string;

  @ApiPropertyOptional({ example: '220-240V' })
  voltaje?: string;

  @ApiPropertyOptional({ example: '1' })
  numeroFases?: string;

  @ApiPropertyOptional({ example: '19mm' })
  diametroEje?: string;

  @ApiPropertyOptional({ example: 'Cónico' })
  tipoEje?: string;

  @ApiPropertyOptional({ example: '1450' })
  rpm?: string;

  @ApiPropertyOptional({ example: 'A-52' })
  correa?: string;

  @ApiPropertyOptional({ example: '150mm' })
  diametroPolea?: string;

  @ApiPropertyOptional({ example: '1.5 HP' })
  capacidadHp?: string;

  @ApiPropertyOptional({ example: '60 Hz' })
  frecuencia?: string;
}

class EvaporatorResponseDto {
  @ApiPropertyOptional({ example: 'Daikin' })
  marca?: string;

  @ApiPropertyOptional({ example: 'FTXS50K' })
  modelo?: string;

  @ApiPropertyOptional({ example: 'EV-987654' })
  serial?: string;

  @ApiPropertyOptional({ example: '18000 BTU' })
  capacidad?: string;

  @ApiPropertyOptional({ example: 'R-410A' })
  tipoRefrigerante?: string;

  @ApiPropertyOptional({ type: [MotorResponseDto] })
  motors?: MotorResponseDto[];
}

class CompressorResponseDto {
  @ApiPropertyOptional({ example: 'Copeland' })
  marca?: string;

  @ApiPropertyOptional({ example: 'ZR48K5E' })
  modelo?: string;

  @ApiPropertyOptional({ example: 'CMP-112233' })
  serial?: string;

  @ApiPropertyOptional({ example: '48000 BTU' })
  capacidad?: string;

  @ApiPropertyOptional({ example: '380V' })
  voltaje?: string;

  @ApiPropertyOptional({ example: '60 Hz' })
  frecuencia?: string;

  @ApiPropertyOptional({ example: 'R-410A' })
  tipoRefrigerante?: string;

  @ApiPropertyOptional({ example: 'POE' })
  tipoAceite?: string;

  @ApiPropertyOptional({ example: '1.8 L' })
  cantidadAceite?: string;

  @ApiPropertyOptional({ example: '45/5 µF' })
  capacitor?: string;

  @ApiPropertyOptional({ example: '120A' })
  lra?: string;

  @ApiPropertyOptional({ example: '18A' })
  fla?: string;

  @ApiPropertyOptional({ example: '4' })
  cantidadPolos?: string;

  @ApiPropertyOptional({ example: '16A' })
  amperaje?: string;

  @ApiPropertyOptional({ example: '24V' })
  voltajeBobina?: string;

  @ApiPropertyOptional({ example: '230V' })
  vac?: string;
}

class CondenserResponseDto {
  @ApiPropertyOptional({ example: 'Daikin' })
  marca?: string;

  @ApiPropertyOptional({ example: 'RXS50K' })
  modelo?: string;

  @ApiPropertyOptional({ example: 'CN-456789' })
  serial?: string;

  @ApiPropertyOptional({ example: '18000 BTU' })
  capacidad?: string;

  @ApiPropertyOptional({ example: '9A' })
  amperaje?: string;

  @ApiPropertyOptional({ example: '220V' })
  voltaje?: string;

  @ApiPropertyOptional({ example: 'R-410A' })
  tipoRefrigerante?: string;

  @ApiPropertyOptional({ example: '1' })
  numeroFases?: string;

  @ApiPropertyOptional({ example: '320 PSI' })
  presionAlta?: string;

  @ApiPropertyOptional({ example: '120 PSI' })
  presionBaja?: string;

  @ApiPropertyOptional({ example: '3.5 HP' })
  hp?: string;

  @ApiPropertyOptional({ type: [MotorResponseDto] })
  motors?: MotorResponseDto[];

  @ApiPropertyOptional({ type: [CompressorResponseDto] })
  compressors?: CompressorResponseDto[];
}

class PlanMantenimientoResponseDto {
  @ApiPropertyOptional({ example: 'MES' })
  unidadFrecuencia?: string;

  @ApiPropertyOptional({ example: 20 })
  diaDelMes?: number;

  @ApiPropertyOptional({ example: '2026-04-15' })
  fechaProgramada?: Date;

  @ApiPropertyOptional({ example: 'Revisión general cada 3 meses' })
  notas?: string;
}

export class EquipmentResponseDto {
  @ApiProperty({ example: 12 })
  equipmentId: number;

  @ApiProperty()
  client: ClientInfoDto;

  @ApiPropertyOptional()
  area?: AreaInfoDto;

  @ApiPropertyOptional()
  subArea?: SubAreaInfoDto;

  // ⚠️ CAMBIO: De workOrderId a workOrders (array)
  @ApiPropertyOptional({ type: [WorkOrderInfoDto] })
  workOrders?: WorkOrderInfoDto[];

  @ApiProperty()
  category: ServiceCategory;

  @ApiPropertyOptional({ example: 1 })
  airConditionerTypeId?: number;

  @ApiPropertyOptional()
  airConditionerType?: {
    id: number;
    name: string;
    hasEvaporator: boolean;
    hasCondenser: boolean;
  };

  @ApiPropertyOptional({ example: 'IM-AA-01-00-01' })
  code?: string | null;

  @ApiProperty()
  status: EquipmentStatus;

  @ApiPropertyOptional()
  installationDate?: Date | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiPropertyOptional({ example: 'juan.perez' })
  createdBy?: string | null;

  @ApiPropertyOptional({ example: 'tecnico1 - Carlos Ruiz' })
  updatedBy?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [EquipmentPhotoDto] })
  photos: EquipmentPhotoDto[];

  @ApiPropertyOptional({ type: [EvaporatorResponseDto] })
  evaporators?: EvaporatorResponseDto[];

  @ApiPropertyOptional({ type: [CondenserResponseDto] })
  condensers?: CondenserResponseDto[];

  @ApiPropertyOptional({ type: PlanMantenimientoResponseDto })
  planMantenimiento?: PlanMantenimientoResponseDto | null;
}