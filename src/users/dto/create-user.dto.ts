// src/users/dto/create-user.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Length,
  IsEnum,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoCedula } from '../enums/Type-cedula.enum';
import { Genero } from '../enums/genero.enum';

export class CreateUserDto {
  @ApiProperty({
    example: 'Juan',
    description: 'Nombre del usuario',
  })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  nombre: string;

  @ApiProperty({
    example: 'Pérez',
    description: 'Apellido del usuario',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El apellido debe ser una cadena de texto' })
  apellido?: string;

  @ApiProperty({
    example: 'juan.perez@imec.com',
    description: 'Correo electrónico del usuario',
  })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido' })
  email: string;

  @ApiProperty({
    example: 'juanperez',
    description: 'Nombre de usuario único',
  })
  @IsNotEmpty({ message: 'El nombre de usuario es requerido' })
  @IsString({ message: 'El nombre de usuario debe ser una cadena de texto' })
  username: string;

  @ApiProperty({
    example: 'password123!',
    description: 'Contraseña del usuario',
    minLength: 6,
  })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @ApiProperty({
    example: '+573001234567',
    description: 'Número de teléfono',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @MaxLength(30, { message: 'El teléfono no puede superar 30 caracteres' })
  @Matches(/^[0-9+\-\s()]*$/, {
    message: 'El teléfono solo puede contener dígitos, espacios y los caracteres + - ( )',
  })
  telefono?: string;

  @ApiProperty({
    example: 2,
    description: 'ID del rol del usuario',
  })
  @IsNotEmpty({ message: 'El rol es requerido' })
  @IsNumber({}, { message: 'El rol debe ser un número' })
  rolId: number;

  @ApiProperty({
    example: true,
    description: 'Estado del usuario',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser un valor booleano' })
  activo?: boolean;

  @ApiProperty({
    example: '1990-05-15',
    description: 'Fecha de nacimiento del usuario',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La fecha de nacimiento debe ser una cadena de texto' })
  fechaNacimiento?: string;

  @ApiProperty({
    example: 'MASCULINO',
    description: 'Género del usuario',
    enum: Genero,
    required: false,
  })
  @IsOptional()
  @IsEnum(Genero, { message: 'El género debe ser MASCULINO, FEMENINO o NO_BINARIO' })
  genero?: Genero;

  @ApiProperty({
    example: '1544247765',
    description: 'Número de Cédula',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La Cédula debe ser una cadena de texto' })
  @Length(6, 10, { message: 'La cédula debe tener entre 6 y 10 caracteres' })
  cedula?: string;

  @ApiProperty({
    example: 'CC',
    description: 'Tipo de cédula',
    enum: TipoCedula,
    required: false,
    default: TipoCedula.CC,
  })
  @IsOptional()
  @IsEnum(TipoCedula, { message: 'El tipo de cédula debe ser CC o PPT' })
  tipoCedula?: TipoCedula;

  @ApiProperty({
    example: 'abc123def456',
    description: 'Token para resetear contraseña',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El reset token debe ser una cadena de texto' })
  resetToken?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de expiración del token',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La fecha de expiración debe ser una cadena de texto' })
  resetTokenExpiry?: string;

  // ---- Nuevos campos de perfil ----
  @ApiProperty({
    example: 'Bogotá, Chapinero',
    description: 'Ubicación de residencia del usuario',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Ubicación demasiado larga' })
  ubicacionResidencia?: string;

  @ApiProperty({
    example: 'ARL Sura',
    description: 'ARL del usuario',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  arl?: string;

  @ApiProperty({
    example: 'EPS Salud Total',
    description: 'EPS del usuario',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  eps?: string;

  @ApiProperty({
    example: 'AFP Colfondos',
    description: 'AFP del usuario',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  afp?: string;

  @ApiProperty({
    example: 'María Pérez',
    description: 'Nombre del contacto de emergencia',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactoEmergenciaNombre?: string;

  @ApiProperty({
    example: '+573001112233',
    description: 'Teléfono del contacto de emergencia',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9+\-\s()]*$/, {
    message: 'El teléfono de contacto debe contener solo dígitos, espacios y los caracteres + - ( )',
  })
  contactoEmergenciaTelefono?: string;

  @ApiProperty({
    example: 'Madre',
    description: 'Parentesco del contacto de emergencia',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactoEmergenciaParentesco?: string;
}