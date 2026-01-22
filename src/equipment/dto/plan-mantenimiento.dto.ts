import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class PlanMantenimientoDto {
  @ApiPropertyOptional({
    example: 'trimestral',
    description: 'Frecuencia del mantenimiento (mensual, trimestral, semestral, anual, etc.)',
  })
  @IsOptional()
  @IsString()
  frecuencia?: string;

  @ApiPropertyOptional({
    example: '2026-04-15',
    description: 'Fecha programada para el próximo mantenimiento',
  })
  @IsOptional()
  @IsDateString()
  fechaProgramada?: string | Date;

  @ApiPropertyOptional({
    example: 'Revisión preventiva general cada 3 meses',
    description: 'Notas adicionales sobre el plan',
  })
  @IsOptional()
  @IsString()
  notas?: string;
}