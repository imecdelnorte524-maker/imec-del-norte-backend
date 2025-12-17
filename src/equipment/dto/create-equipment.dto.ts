import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceCategory } from '../../services/enums/service.enums';
import { EquipmentStatus } from '../enums/equipment-status.enum';

export class CreateEquipmentDto {
  @ApiProperty({
    example: 1,
    description: 'ID del cliente (empresa) al que pertenece el equipo',
  })
  @IsNotEmpty({ message: 'El cliente es requerido' })
  @IsNumber({}, { message: 'El ID del cliente debe ser un número' })
  clientId: number;

  @ApiProperty({
    example: 2,
    description: 'ID del área donde está ubicado el equipo (opcional)',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID del área debe ser un número' })
  areaId?: number;

  @ApiProperty({
    example: 3,
    description: 'ID de la subárea donde está ubicado el equipo (opcional)',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID de la subárea debe ser un número' })
  subAreaId?: number;

  @ApiProperty({
    example: ServiceCategory.AIRES_ACONDICIONADOS,
    description: 'Categoría del equipo (línea de negocio)',
    enum: ServiceCategory,
  })
  @IsNotEmpty({ message: 'La categoría del equipo es requerida' })
  @IsEnum(ServiceCategory, {
    message: 'La categoría del equipo no es válida',
  })
  category: ServiceCategory;

  @ApiProperty({
    example: 'Aire acondicionado sala de juntas 1',
    description: 'Nombre o identificación del equipo',
  })
  @IsNotEmpty({ message: 'El nombre del equipo es requerido' })
  @IsString({ message: 'El nombre del equipo debe ser una cadena de texto' })
  name: string;

  @ApiProperty({
    example: 'AA-SJ-001',
    description: 'Código interno del equipo (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El código del equipo debe ser una cadena de texto' })
  code?: string;

  @ApiProperty({
    example: 'Samsung',
    description: 'Marca del equipo',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La marca debe ser una cadena de texto' })
  brand?: string;

  @ApiProperty({
    example: 'AR12TX',
    description: 'Modelo del equipo',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El modelo debe ser una cadena de texto' })
  model?: string;

  @ApiProperty({
    example: 'SN1234567890',
    description: 'Número de serie del equipo',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El número de serie debe ser una cadena de texto' })
  serialNumber?: string;

  @ApiProperty({
    example: '12000 BTU',
    description: 'Capacidad del equipo (ej. para aires acondicionados)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La capacidad debe ser una cadena de texto' })
  capacity?: string;

  @ApiProperty({
    example: 'R410A',
    description: 'Tipo de refrigerante (para aires acondicionados)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El tipo de refrigerante debe ser una cadena de texto' })
  refrigerantType?: string;

  @ApiProperty({
    example: '220V',
    description: 'Voltaje del equipo',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El voltaje debe ser una cadena de texto' })
  voltage?: string;

  @ApiProperty({
    example: 'Techo bodega 1',
    description: 'Ubicación física del equipo',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La ubicación física debe ser una cadena de texto' })
  physicalLocation?: string;

  @ApiProperty({
    example: 'LG',
    description: 'Fabricante del equipo',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El fabricante debe ser una cadena de texto' })
  manufacturer?: string;

  @ApiProperty({
    example: EquipmentStatus.ACTIVE,
    description: 'Estado del equipo',
    enum: EquipmentStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(EquipmentStatus, {
    message: 'El estado del equipo no es válido',
  })
  status?: EquipmentStatus;

  @ApiProperty({
    example: '2024-01-15',
    description: 'Fecha de instalación del equipo',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de instalación debe ser válida' })
  installationDate?: Date;

  @ApiProperty({
    example: 'Equipo instalado en buen estado, sin novedades.',
    description: 'Observaciones generales del equipo',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto' })
  notes?: string;
}