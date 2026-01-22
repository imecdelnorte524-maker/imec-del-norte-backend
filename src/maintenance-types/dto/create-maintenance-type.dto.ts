import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMaintenanceTypeDto {
  @ApiProperty({ example: 'Preventivo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ example: 'Mantenimiento programado para evitar fallos' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}