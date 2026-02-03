// src/users/dto/user-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoCedula } from '../enums/Type-cedula.enum';
import { Genero } from '../enums/genero.enum';

export class UserResponseDto {
  @ApiProperty({ example: 1, description: 'ID del usuario' })
  usuarioId: number;

  @ApiProperty({ example: 'Juan', description: 'Nombre del usuario' })
  nombre: string;

  @ApiProperty({ example: 'Pérez', description: 'Apellido del usuario' })
  apellido: string;

  @ApiProperty({ example: 'juan.perez@imec.com', description: 'Correo electrónico' })
  email: string;

  @ApiPropertyOptional({ example: '1244575548', description: 'Número de Cédula' })
  cedula?: string;

  @ApiProperty({ example: 'juanperez', description: 'Nombre de usuario' })
  username: string;

  @ApiProperty({ example: '3001234567', description: 'Número de teléfono' })
  telefono: string;

  @ApiProperty({ example: true, description: 'Estado del usuario' })
  activo: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Fecha de creación del usuario' })
  fechaCreacion: string;

  @ApiProperty({ example: '1990-05-15', description: 'Fecha de nacimiento del usuario', required: false })
  fechaNacimiento?: string;

  @ApiProperty({ example: 'MASCULINO', description: 'Género del usuario', enum: Genero, required: false })
  genero?: Genero;

  @ApiProperty({ example: { rolId: 1, nombreRol: 'Administrador' }, description: 'Rol del usuario' })
  role: {
    rolId: number;
    nombreRol: string;
  };

  @ApiPropertyOptional({ example: 'CC', description: 'Tipo de cédula', enum: TipoCedula })
  tipoCedula?: TipoCedula;

  @ApiPropertyOptional({ example: 'Supervisor de Planta', description: 'Cargo del usuario' })
  position?: string;

  @ApiProperty({ example: 'abc123def456', description: 'Token para resetear contraseña', required: false })
  resetToken?: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Fecha de expiración del token', required: false })
  resetTokenExpiry?: string;

  // ---- Nuevos campos de perfil ----
  @ApiProperty({ example: 'Bogotá, Chapinero', description: 'Ubicación de residencia', required: false })
  ubicacionResidencia?: string;

  @ApiProperty({ example: 'ARL Sura', description: 'ARL', required: false })
  arl?: string;

  @ApiProperty({ example: 'EPS Salud Total', description: 'EPS', required: false })
  eps?: string;

  @ApiProperty({ example: 'AFP Colfondos', description: 'AFP', required: false })
  afp?: string;

  @ApiProperty({ example: 'María Pérez', description: 'Contacto de emergencia - nombre', required: false })
  contactoEmergenciaNombre?: string;

  @ApiProperty({ example: '+573001112233', description: 'Contacto de emergencia - teléfono', required: false })
  contactoEmergenciaTelefono?: string;

  @ApiProperty({ example: 'Madre', description: 'Contacto de emergencia - parentesco', required: false })
  contactoEmergenciaParentesco?: string;
}