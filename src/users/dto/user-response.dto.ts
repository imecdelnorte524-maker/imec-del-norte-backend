import { ApiProperty } from '@nestjs/swagger';
import { TipoCedula } from '../enums/Type-cedula.enum';

export class UserResponseDto {
  @ApiProperty({
    example: 1,
    description: 'ID del usuario',
  })
  usuarioId: number;

  @ApiProperty({
    example: 'Juan',
    description: 'Nombre del usuario',
  })
  nombre: string;

  @ApiProperty({
    example: 'Pérez',
    description: 'Apellido del usuario',
  })
  apellido: string;

  @ApiProperty({
    example: 'juan.perez@imec.com',
    description: 'Correo electrónico del usuario',
  })
  email: string;

  @ApiProperty({
    example: '1244575548',
    description: 'Numero de Cédula',
  })
  cedula: string;

  @ApiProperty({
    example: 'juanperez',
    description: 'Nombre de usuario',
  })
  username: string;

  @ApiProperty({
    example: '3001234567',
    description: 'Número de teléfono',
  })
  telefono: string;

  @ApiProperty({
    example: true,
    description: 'Estado del usuario',
  })
  activo: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de creación del usuario',
  })
  fechaCreacion: Date;

  @ApiProperty({
    example: { rolId: 1, nombreRol: 'Administrador' },
    description: 'Rol del usuario',
  })
  role: {
    rolId: number;
    nombreRol: string;
  };
  
   @ApiProperty({
    example: 'CC',
    description: 'Tipo de cédula',
    enum: TipoCedula
  })
  tipoCedula: TipoCedula;

   @ApiProperty({ 
    example: 'abc123def456', 
    description: 'Token para resetear contraseña',
    required: false 
  })
  resetToken?: string;

  @ApiProperty({ 
    example: '2024-01-01T00:00:00.000Z', 
    description: 'Fecha de expiración del token',
    required: false 
  })
  resetTokenExpiry?: Date;
}