import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceCategory } from '../../services/enums/service.enums';
import { EquipmentStatus } from '../enums/equipment-status.enum';
import { Type } from 'class-transformer';

// --- DTOs para componentes anidados ---

class CreateMotorDto {
  @ApiPropertyOptional({ example: '10A' })
  @IsOptional()
  @IsString()
  amperaje?: string;

  @ApiPropertyOptional({ example: '220V' })
  @IsOptional()
  @IsString()
  voltaje?: string;

  @ApiPropertyOptional({ example: '1500' })
  @IsOptional()
  @IsString()
  rpm?: string;

  @ApiPropertyOptional({ example: 'SN123456' })
  @IsOptional()
  @IsString()
  serialMotor?: string;

  @ApiPropertyOptional({ example: 'MTR-001' })
  @IsOptional()
  @IsString()
  modeloMotor?: string;

  @ApiPropertyOptional({ example: '12mm' })
  @IsOptional()
  @IsString()
  diametroEje?: string;

  @ApiPropertyOptional({ example: 'Redondo' })
  @IsOptional()
  @IsString()
  tipoEje?: string;
}

class CreateEvaporatorDto {
  @ApiPropertyOptional({ example: 'Samsung' })
  @IsOptional()
  @IsString()
  marca?: string;

  @ApiPropertyOptional({ example: 'AEV12' })
  @IsOptional()
  @IsString()
  modelo?: string;

  @ApiPropertyOptional({ example: 'EV123456' })
  @IsOptional()
  @IsString()
  serial?: string;

  @ApiPropertyOptional({ example: '12000 BTU' })
  @IsOptional()
  @IsString()
  capacidad?: string;

  @ApiPropertyOptional({ example: '8A' })
  @IsOptional()
  @IsString()
  amperaje?: string;

  @ApiPropertyOptional({ example: 'R410A' })
  @IsOptional()
  @IsString()
  tipoRefrigerante?: string;

  @ApiPropertyOptional({ example: '220V' })
  @IsOptional()
  @IsString()
  voltaje?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  numeroFases?: string;
}

class CreateCompressorDto {
  @ApiPropertyOptional({ example: 'Samsung' })
  @IsOptional()
  @IsString()
  marca?: string;

  @ApiPropertyOptional({ example: 'AEV12' })
  @IsOptional()
  @IsString()
  modelo?: string;

  @ApiPropertyOptional({ example: 'EV123456' })
  @IsOptional()
  @IsString()
  serial?: string;

  @ApiPropertyOptional({ example: '12000 BTU' })
  @IsOptional()
  @IsString()
  capacidad?: string;

  @ApiPropertyOptional({ example: '8A' })
  @IsOptional()
  @IsString()
  amperaje?: string;

  @ApiPropertyOptional({ example: 'R410A' })
  @IsOptional()
  @IsString()
  tipoRefrigerante?: string;

  @ApiPropertyOptional({ example: '220V' })
  @IsOptional()
  @IsString()
  voltaje?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  numeroFases?: string;

  @ApiPropertyOptional({ example: '15W' })
  @IsOptional()
  @IsString()
  tipoAceite?: string;

  @ApiPropertyOptional({ example: '15W' })
  @IsOptional()
  @IsString()
  cantidadAceite?: string;
}

class CreateCondenserDto {
  @ApiPropertyOptional({ example: 'Samsung' })
  @IsOptional()
  @IsString()
  marca?: string;

  @ApiPropertyOptional({ example: 'CNV12' })
  @IsOptional()
  @IsString()
  modelo?: string;

  @ApiPropertyOptional({ example: 'CN123456' })
  @IsOptional()
  @IsString()
  serial?: string;

  @ApiPropertyOptional({ example: '12000 BTU' })
  @IsOptional()
  @IsString()
  capacidad?: string;

  @ApiPropertyOptional({ example: '8A' })
  @IsOptional()
  @IsString()
  amperaje?: string;

  @ApiPropertyOptional({ example: '220V' })
  @IsOptional()
  @IsString()
  voltaje?: string;

  @ApiPropertyOptional({ example: 'R410A' })
  @IsOptional()
  @IsString()
  tipoRefrigerante?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  numeroFases?: string;

  @ApiPropertyOptional({ example: '150 PSI' })
  @IsOptional()
  @IsString()
  presionAlta?: string;

  @ApiPropertyOptional({ example: '50 PSI' })
  @IsOptional()
  @IsString()
  presionBaja?: string;

  @ApiPropertyOptional({ example: '2.5' })
  @IsOptional()
  @IsString()
  hp?: string;
}

// --- DTO principal ---

export class CreateEquipmentDto {
  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsNumber()
  clientId: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  areaId?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  subAreaId?: number;

  @ApiProperty({
    example: ServiceCategory.AIRES_ACONDICIONADOS,
    enum: ServiceCategory,
  })
  @IsNotEmpty()
  @IsEnum(ServiceCategory)
  category: ServiceCategory;

  @ApiPropertyOptional({
    example: 1,
    description:
      'ID del tipo de aire (solo si category = Aires Acondicionados)',
  })
  @IsOptional()
  @IsNumber()
  airConditionerTypeId?: number;

  @ApiProperty({ example: 'Aire sala de juntas' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Techo bodega 1' })
  @IsOptional()
  @IsString()
  physicalLocation?: string;

  @ApiPropertyOptional({
    example: EquipmentStatus.ACTIVE,
    enum: EquipmentStatus,
  })
  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  installationDate?: Date;

  @ApiPropertyOptional({ example: 'Equipo en buen estado' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'AC-001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  workOrderId?: number;

  // --- Componentes anidados ---

  @ApiPropertyOptional({
    type: CreateMotorDto,
    description: 'Datos del motor (opcional)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateMotorDto)
  motor?: CreateMotorDto;

  @ApiPropertyOptional({
    type: CreateEvaporatorDto,
    description: 'Datos del evaporador (opcional)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateEvaporatorDto)
  evaporator?: CreateEvaporatorDto;

  @ApiPropertyOptional({
    type: CreateCondenserDto,
    description: 'Datos de la condensadora (opcional)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCondenserDto)
  condenser?: CreateCondenserDto;

  // También incluimos el compressor por si acaso
  @ApiPropertyOptional({
    type: CreateCompressorDto,
    description: 'Datos del compresor (opcional)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCompressorDto)
  compressor?: CreateCompressorDto;
}
