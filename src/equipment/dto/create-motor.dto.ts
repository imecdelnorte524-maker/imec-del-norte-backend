import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateMotorDto {
  @ApiPropertyOptional({
    example: '8.5A',
    description: 'Amperaje del motor',
  })
  @IsOptional()
  @IsString()
  amperaje?: string;

  @ApiPropertyOptional({
    example: '220-240V',
    description: 'Voltaje del motor',
  })
  @IsOptional()
  @IsString()
  voltaje?: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Número de fases (1 o 3)',
  })
  @IsOptional()
  @IsString()
  numeroFases?: string;

  @ApiPropertyOptional({
    example: '#4',
    description: 'Número de partes',
  })
  @IsOptional()
  @IsString()
  numeroParte?: string;

  @ApiPropertyOptional({
    example: '19mm',
    description: 'Diámetro del eje',
  })
  @IsOptional()
  @IsString()
  diametroEje?: string;

  @ApiPropertyOptional({
    example: 'Cónico',
    description: 'Tipo de eje (redondo, cónico, etc.)',
  })
  @IsOptional()
  @IsString()
  tipoEje?: string;

  @ApiPropertyOptional({
    example: '1450',
    description: 'RPM del motor',
  })
  @IsOptional()
  @IsString()
  rpm?: string;

  @ApiPropertyOptional({
    example: 'A-52',
    description: 'Tipo o medida de la correa (opcional)',
  })
  @IsOptional()
  @IsString()
  correa?: string;

  @ApiPropertyOptional({
    example: '150mm',
    description: 'Diámetro de la polea (opcional)',
  })
  @IsOptional()
  @IsString()
  diametroPolea?: string;

  @ApiPropertyOptional({
    example: '1.5 HP',
    description: 'Capacidad en HP',
  })
  @IsOptional()
  @IsString()
  capacidadHp?: string;

  @ApiPropertyOptional({
    example: '60 Hz',
    description: 'Frecuencia de operación',
  })
  @IsOptional()
  @IsString()
  frecuencia?: string;
}