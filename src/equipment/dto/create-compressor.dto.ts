import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCompressorDto {
  @ApiPropertyOptional({
    example: 'Copeland',
    description: 'Marca del compresor',
  })
  @IsOptional()
  @IsString()
  marca?: string;

  @ApiPropertyOptional({
    example: 'ZR48K5E',
    description: 'Modelo del compresor',
  })
  @IsOptional()
  @IsString()
  modelo?: string;

  @ApiPropertyOptional({
    example: 'CMP-1122334455',
    description: 'Número de serie',
  })
  @IsOptional()
  @IsString()
  serial?: string;

  @ApiPropertyOptional({
    example: '48000 BTU',
    description: 'Capacidad en BTU',
  })
  @IsOptional()
  @IsString()
  capacidad?: string;

  @ApiPropertyOptional({
    example: '380V',
    description: 'Voltaje',
  })
  @IsOptional()
  @IsString()
  voltaje?: string;

  @ApiPropertyOptional({
    example: '60 Hz',
    description: 'Frecuencia',
  })
  @IsOptional()
  @IsString()
  frecuencia?: string;

  @ApiPropertyOptional({
    example: 'R-410A',
    description: 'Tipo de refrigerante',
  })
  @IsOptional()
  @IsString()
  tipoRefrigerante?: string;

  @ApiPropertyOptional({
    example: 'POE',
    description: 'Tipo de aceite',
  })
  @IsOptional()
  @IsString()
  tipoAceite?: string;

  @ApiPropertyOptional({
    example: '1.8 L',
    description: 'Cantidad de aceite',
  })
  @IsOptional()
  @IsString()
  cantidadAceite?: string;

  @ApiPropertyOptional({
    example: '45/5 µF',
    description: 'Capacitor',
  })
  @IsOptional()
  @IsString()
  capacitor?: string;

  @ApiPropertyOptional({
    example: '120A',
    description: 'LRA (Locked Rotor Amps)',
  })
  @IsOptional()
  @IsString()
  lra?: string;

  @ApiPropertyOptional({
    example: '18A',
    description: 'FLA (Full Load Amps)',
  })
  @IsOptional()
  @IsString()
  fla?: string;

  @ApiPropertyOptional({
    example: '4',
    description: 'Cantidad de polos',
  })
  @IsOptional()
  @IsString()
  cantidadPolos?: string;

  @ApiPropertyOptional({
    example: '16A',
    description: 'Amperaje',
  })
  @IsOptional()
  @IsString()
  amperaje?: string;

  @ApiPropertyOptional({
    example: '24V',
    description: 'Voltaje de bobina',
  })
  @IsOptional()
  @IsString()
  voltajeBobina?: string;

  @ApiPropertyOptional({
    example: '230V',
    description: 'VAC (voltaje de arranque o similar)',
  })
  @IsOptional()
  @IsString()
  vac?: string;
}