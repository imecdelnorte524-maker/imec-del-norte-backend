import { ApiProperty } from '@nestjs/swagger';
import { RoleResponseDto } from '../../roles/dto/role-response.dto'; // Importa el DTO de respuesta del rol

export class ModuleResponseDto {
  @ApiProperty({ description: 'ID del módulo', example: 1 })
  moduloId: number;

  @ApiProperty({ description: 'Nombre del módulo', example: 'Gestión de Usuarios' })
  nombreModulo: string;

  @ApiProperty({ description: 'Descripción detallada del módulo', example: 'Este módulo permite la administración completa de usuarios...' })
  descripcion: string;

  @ApiProperty({ description: 'Estado de actividad del módulo', example: true })
  activo: boolean;

  @ApiProperty({ description: 'Orden de visualización del módulo', example: 1 })
  orden: number;

  @ApiProperty({ description: 'Ruta del frontend asociada', example: '/admin/users' })
  rutaFrontend: string;

  @ApiProperty({ description: 'Icono del módulo', example: 'user-cog' })
  icono: string;

  @ApiProperty({ description: 'Código interno del módulo', example: 'MOD_USER_MGT' })
  codigoInterno: string;

  @ApiProperty({ description: 'Fecha de creación del módulo', example: '2024-01-01T00:00:00.000Z' })
  fechaCreacion: Date;

  @ApiProperty({ description: 'Fecha de la última actualización del módulo', example: '2024-01-02T10:30:00.000Z' })
  fechaActualizacion: Date;

  @ApiProperty({ description: 'Lista de roles que tienen acceso a este módulo', type: [RoleResponseDto] })
  roles: RoleResponseDto[]; // Incluye los DTOs completos de los roles
}