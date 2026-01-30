import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { UnidadFrecuencia } from '../enums/frecuency-unity.enum';
import { Type } from 'class-transformer';

export class PlanMantenimientoDto {
  @ApiPropertyOptional({
    enum: UnidadFrecuencia,
    example: UnidadFrecuencia.MES,
    description: 'Unidad de frecuencia del mantenimiento (DIA, SEMANA o MES)',
  })
  @IsOptional()
  @IsEnum(UnidadFrecuencia)
  unidadFrecuencia?: UnidadFrecuencia;

  @ApiPropertyOptional({
    example: 15,
    minimum: 1,
    maximum: 31,
    description:
      'Día del mes (1-31) en el que se programa el mantenimiento. ' +
      'Normalmente aplica cuando unidadFrecuencia = MES',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  diaDelMes?: number;

  @ApiPropertyOptional({
    example: '2026-04-15',
    description: 'Fecha programada para el próximo mantenimiento',
  })
  @IsOptional()
  @IsDateString()
  fechaProgramada?: string | Date;

  @ApiPropertyOptional({
    example: 'Revisión preventiva general',
    description: 'Notas adicionales sobre el plan',
  })
  @IsOptional()
  @IsString()
  notas?: string;
}