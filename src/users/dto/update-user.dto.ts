import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, IsBoolean, IsNumber, Length, IsEnum, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoCedula } from '../enums/Type-cedula.enum';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    example: 'Juan Carlos',
    description: 'Nombre del usuario',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  nombre?: string;

  @ApiProperty({
    example: 'Pérez García',
    description: 'Apellido del usuario',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El apellido debe ser una cadena de texto' })
  apellido?: string;

  @ApiProperty({
    example: 'nuevo.email@imec.com',
    description: 'Correo electrónico del usuario',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El correo electrónico debe ser una cadena de texto' })
  email?: string;

  @ApiProperty({
    example: 'juanperezg',
    description: 'Nombre de usuario único',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El nombre de usuario debe ser una cadena de texto' })
  username?: string;

  @ApiProperty({
    example: '+573009876543',
    description: 'Número de teléfono',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  telefono?: string;

  @ApiProperty({
    example: 3,
    description: 'ID del rol del usuario',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El rol debe ser un número' })
  rolId?: number;

  @ApiProperty({
    example: false,
    description: 'Estado del usuario',
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'El estado debe ser un valor booleano' })
  activo?: boolean;

  @ApiProperty({
    example: '1544247765',
    description: 'Número de Cédula',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La Cédula debe ser una cadena de texto' })
  @Length(6, 10, { message: 'La cédula debe tener entre 8 y 10 caracteres' })
  cedula?: string;

  @ApiProperty({
    example: 'E',
    description: 'Tipo de cédula',
    required: false,
    enum: TipoCedula
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
  @IsDate({ message: 'La fecha de expiración debe ser una fecha válida' })
  resetTokenExpiry?: Date;
}