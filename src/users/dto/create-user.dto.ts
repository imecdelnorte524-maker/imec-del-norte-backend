import { IsEmail, IsNotEmpty, MinLength, IsString, IsOptional, IsNumber, IsBoolean, Length, IsEnum, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoCedula } from '../enums/Type-cedula.enum';

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
    example: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    description: 'Hash de la contraseña (solo para uso interno)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El hash de la contraseña debe ser una cadena de texto' })
  passwordHash?: string;

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
    example: 'CC',
    description: 'Tipo de cédula (CC: Cedula de Ciudadania, PPT: Permiso por Protección Temporal)',
    enum: TipoCedula,
    required: false,
    default: TipoCedula.CC
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