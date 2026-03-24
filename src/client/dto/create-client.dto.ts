import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  Length,
  IsOptional,
  IsUrl,
  IsDateString,
  IsArray,
  ArrayMinSize,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ClientType {
  JURIDICA = 'juridica',
  NATURAL = 'natural',
}

export class CreateClientDto {
  @ApiProperty({
    enum: ClientType,
    default: ClientType.JURIDICA,
    description: 'Tipo de cliente: jurídica (empresa) o natural (persona)',
  })
  @IsOptional()
  @IsEnum(ClientType)
  tipoCliente?: ClientType;

  @ApiProperty({ example: 'IMEC del Norte', description: 'Nombre del cliente' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  nombre: string;

  @ApiProperty({
    example: '900123456',
    description:
      'NIT del cliente (requerido para persona jurídica, opcional para natural)',
    required: false,
  })
  @IsOptional()
  nit?: string;

  @ApiProperty({
    example: '7',
    description:
      'Digito de Verificación del NIT (requerido para jurídica, opcional para natural)',
    required: false,
  })
  @IsOptional()
  verification_digit?: string;

  @ApiProperty({
    example: 'Calle 123 #45-67',
    description: 'Dirección base (calle, carrera, número)',
  })
  @IsNotEmpty({ message: 'La dirección base es requerida' })
  @IsString({ message: 'La dirección base debe ser una cadena de texto' })
  direccionBase: string;

  @ApiProperty({
    example: 'El Poblado',
    description: 'Barrio del cliente (opcional para persona natural)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El barrio debe ser una cadena de texto' })
  barrio?: string;

  @ApiProperty({ example: 'Medellín', description: 'Ciudad del cliente' })
  @IsNotEmpty({ message: 'La ciudad es requerida' })
  @IsString({ message: 'La ciudad debe ser una cadena de texto' })
  ciudad: string;

  @ApiProperty({
    example: 'Antioquia',
    description: 'Departamento del cliente (opcional para persona natural)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El departamento debe ser una cadena de texto' })
  departamento?: string;

  @ApiProperty({
    example: 'Colombia',
    description: 'País del cliente (opcional para persona natural)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El país debe ser una cadena de texto' })
  pais?: string;

  @ApiProperty({
    example: 'Calle 123 #45-67, El Poblado, Medellín, Antioquia, Colombia',
    description: 'Dirección completa (autogenerada)',
    readOnly: true,
    required: false,
  })
  @IsOptional()
  @IsString()
  direccionCompleta?: string;

  @ApiProperty({ example: 'Juan Pérez', description: 'Persona de contacto' })
  @IsString({ message: 'El contacto debe ser una cadena de texto' })
  @IsOptional()
  contacto?: string;

  @ApiProperty({
    example: 'cliente@imec.com',
    description: 'Email del cliente (opcional para persona natural)',
    required: false,
  })
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: '3001234567',
    description: 'Teléfono del cliente',
  })
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  telefono: string;

  @ApiProperty({
    example: 'https://www.google.com/maps/place/...',
    description: 'URL de Google Maps con la ubicación del cliente',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'La ubicación debe ser una URL válida' })
  localizacion?: string;

  @ApiProperty({
    example: '2015-06-01',
    description:
      'Fecha de creación de la empresa (requerido para jurídica, opcional para natural)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  fechaCreacionEmpresa?: string | null;

  @ApiProperty({
    example: false,
    description: 'Plan de mantenimiento automático',
  })
  @IsOptional()
  @IsBoolean()
  planMantenimientoAutomatico?: boolean;

  @ApiProperty({
    example: [1, 2, 3],
    description: 'IDs de los usuarios contacto',
    required: false,
  })
  @IsOptional()
  @IsArray({ message: 'Los IDs de usuarios contacto deben ser un array' })
  @IsNumber({}, { each: true, message: 'Cada ID debe ser un número' })
  @ArrayMinSize(1, { message: 'Debe haber al menos un usuario contacto' })
  usuariosContactoIds?: number[];
}
