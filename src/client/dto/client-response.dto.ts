import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 1, description: 'ID del usuario' })
  usuarioId: number;

  @ApiProperty({ example: 'juan.perez', description: 'Nombre de usuario' })
  username: string;

  @ApiProperty({ example: 'Juan', description: 'Nombre' })
  nombre: string;

  @ApiProperty({ example: 'Pérez', description: 'Apellido' })
  apellido: string;

  @ApiProperty({ example: 'juan.perez@email.com', description: 'Email' })
  email: string;

  @ApiProperty({ example: '3001234567', description: 'Teléfono' })
  telefono: string;

  @ApiProperty({ example: 'Administrador', description: 'Nombre del rol' })
  role: string;
}

export class ClientResponseDto {
  @ApiProperty({ example: 1, description: 'ID del cliente' })
  idCliente: number;

  @ApiProperty({ example: 'IMEC del Norte', description: 'Nombre del cliente' })
  nombre: string;

  @ApiProperty({ example: '900123456-7', description: 'NIT del cliente' })
  nit: string;

  @ApiProperty({ example: 7, description: 'Este es el digito de verificación' })
  verification_digit?: number;

  @ApiProperty({
    example: 'Calle 123 #45-67',
    description: 'Dirección base',
  })
  direccionBase: string;

  @ApiProperty({ example: 'El Poblado', description: 'Barrio' })
  barrio: string;

  @ApiProperty({ example: 'Medellín', description: 'Ciudad' })
  ciudad: string;

  @ApiProperty({ example: 'Antioquia', description: 'Departamento' })
  departamento: string;

  @ApiProperty({ example: 'Colombia', description: 'País' })
  pais: string;

  @ApiProperty({
    example: 'Calle 123 #45-67, El Poblado, Medellín, Antioquia, Colombia',
    description: 'Dirección completa (autogenerada)',
  })
  direccionCompleta: string;

  @ApiProperty({ example: 'Juan Pérez', description: 'Persona de contacto' })
  contacto: string;

  @ApiProperty({
    example: 'cliente@imec.com',
    description: 'Email del cliente',
  })
  email: string;

  @ApiProperty({
    example: '3001234567',
    description: 'Teléfono del cliente',
  })
  telefono: string;

  @ApiProperty({
    example: 'https://www.google.com/maps/place/...',
    description: 'URL de Google Maps',
  })
  localizacion: string;

  @ApiProperty({
    example: '2015-06-01',
    description: 'Fecha de creación de la empresa',
  })
  fechaCreacionEmpresa: string;

  @ApiProperty({
    description: 'Usuarios contacto del cliente',
    type: () => [UserResponseDto],
  })
  usuariosContacto: UserResponseDto[];

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de creación del registro',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de última actualización',
  })
  updatedAt: Date;
}

export class ClientSimpleResponseDto {
  @ApiProperty({ example: 1, description: 'ID del cliente' })
  idCliente: number;

  @ApiProperty({ example: 'IMEC del Norte', description: 'Nombre del cliente' })
  nombre: string;

  @ApiProperty({ example: '900123456-7', description: 'NIT del cliente' })
  nit: string;

  @ApiProperty({
    example: 'Calle 123 #45-67, El Poblado, Medellín',
    description: 'Dirección completa',
  })
  direccionCompleta: string;

  @ApiProperty({ example: 'Juan Pérez', description: 'Persona de contacto' })
  contacto: string;

  @ApiProperty({
    example: 'cliente@imec.com',
    description: 'Email del cliente',
  })
  email: string;

  @ApiProperty({
    example: '3001234567',
    description: 'Teléfono del cliente',
  })
  telefono: string;

  @ApiProperty({
    example: ['Juan Pérez', 'María Gómez'],
    description: 'Nombres de usuarios contacto',
  })
  usuariosContactoNombres: string[];
}
