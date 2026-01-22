import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsBoolean, IsArray, IsNumber, IsInt } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({
    description: 'Nombre único del módulo',
    example: 'Gestión de Usuarios',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombreModulo: string;

  @ApiPropertyOptional({
    description: 'Descripción detallada de la funcionalidad del módulo',
    example: 'Este módulo permite la administración completa de usuarios, incluyendo creación, edición, eliminación y asignación de roles. Ideal para la vista principal del frontend.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Indica si el módulo está activo y es visible',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @ApiPropertyOptional({
    description: 'Orden de visualización del módulo en la interfaz de usuario',
    example: 1,
    default: 0,
  })
  @IsInt()
  @IsOptional()
  orden?: number;

  @ApiPropertyOptional({
    description: 'Ruta del frontend a la que redirige este módulo',
    example: '/admin/users',
    nullable: true,
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  rutaFrontend?: string;

  @ApiPropertyOptional({
    description: 'Nombre del icono asociado al módulo (ej. un icono de FontAwesome o Material)',
    example: 'user-cog',
    nullable: true,
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  icono?: string;

  @ApiPropertyOptional({
    description: 'Código único interno para referencia del módulo',
    example: 'MOD_USER_MGT',
    nullable: true,
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  codigoInterno?: string;

  @ApiPropertyOptional({
    description: 'IDs de los roles que tienen acceso a este módulo',
    example: [1, 2],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  roles?: number[]; // Array de IDs de roles
}