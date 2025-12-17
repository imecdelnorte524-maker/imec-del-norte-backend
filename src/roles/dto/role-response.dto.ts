import { ApiProperty } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({
    description: 'ID del rol',
    example: 1,
  })
  rolId: number;

  @ApiProperty({
    description: 'Nombre del rol',
    example: 'Administrador',
  })
  nombreRol: string;

  @ApiProperty({
    description: 'Descripción del rol',
    example: 'Rol con acceso completo al sistema',
    nullable: true,
  })
  descripcion?: string;

  @ApiProperty({
    description: 'Fecha de creación del rol',
    example: '2024-01-01T00:00:00.000Z',
  })
  fechaCreacion: Date;
}