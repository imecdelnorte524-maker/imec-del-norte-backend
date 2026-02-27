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
import { ServiceCategory } from '../../shared/index';
import { EquipmentStatus } from '../../shared/index';
import { Type } from 'class-transformer';
import { CreateEvaporatorDto } from './create-evaporator.dto';
import { CreateCondenserDto } from './create-condenser.dto';
import { PlanMantenimientoDto } from './plan-mantenimiento.dto';

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
    description: 'ID del tipo de aire (solo si category = AIRES_ACONDICIONADOS)',
  })
  @IsOptional()
  @IsNumber()
  airConditionerTypeId?: number;

  @ApiPropertyOptional({ example: EquipmentStatus.ACTIVE, enum: EquipmentStatus })
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

  @ApiPropertyOptional({ type: [CreateEvaporatorDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateEvaporatorDto)
  evaporators?: CreateEvaporatorDto[];

  @ApiPropertyOptional({ type: [CreateCondenserDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateCondenserDto)
  condensers?: CreateCondenserDto[];

  @ApiPropertyOptional({ type: PlanMantenimientoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlanMantenimientoDto)
  planMantenimiento?: PlanMantenimientoDto;
}