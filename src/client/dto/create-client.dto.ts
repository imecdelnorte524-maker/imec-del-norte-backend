import { IsEmail, IsNotEmpty, IsNumber, IsString, Length, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: 'IMEC del Norte', description: 'Nombre del cliente' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  nombre: string;

  @ApiProperty({ example: '900123456-7', description: 'NIT del cliente' })
  @IsNotEmpty({ message: 'El NIT es requerido' })
  @IsString({ message: 'El NIT debe ser una cadena de texto' })
  @Length(5, 20, { message: 'El NIT debe tener entre 5 y 20 caracteres' })
  nit: string;

  @ApiProperty({ example: 'Calle 123 #45-67', description: 'Dirección del cliente' })
  @IsNotEmpty({ message: 'La dirección es requerida' })
  @IsString({ message: 'La dirección debe ser una cadena de texto' })
  direccion: string;

  @ApiProperty({ example: 'Juan Pérez', description: 'Persona de contacto' })
  @IsString({ message: 'El contacto debe ser una cadena de texto' })
  @IsOptional()
  contacto?: string;

  @ApiProperty({ example: 'cliente@imec.com', description: 'Email del cliente' })
  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @ApiProperty({ example: '3001234567', description: 'Teléfono del cliente' })
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  telefono: string;

  @ApiProperty({ example: 'Bogotá, Colombia', description: 'Ubicación geográfica' })
  @IsNotEmpty({ message: 'La ubicación es requerida' })
  @IsString({ message: 'La ubicación debe ser una cadena de texto' })
  localizacion: string;

  @ApiProperty({
    example: 1,
    description: 'ID del usuario contacto',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID de usuario debe ser un número' })
  idUsuarioContacto?: number;
}