// src/sg-sst/dto/create-preoperational-checklist-template.dto.ts
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PreoperationalParameterCategory } from '../../shared/index';

export class CreatePreoperationalChecklistParameterDto {
  @ApiProperty({
    description: 'Código del parámetro (opcional), ej: ESC-001',
    required: false,
    example: 'ESC-001',
  })
  @IsString()
  @IsOptional()
  parameterCode?: string;

  @ApiProperty({
    description: 'Texto del parámetro a verificar',
    example: '¿Bisagra con seguro, para fijar, funcional/firme?',
  })
  @IsString()
  parameter: string;

  @ApiProperty({
    description: 'Descripción adicional del parámetro',
    required: false,
    example: 'Verificar que la bisagra no presente juego excesivo',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Categoría del parámetro',
    enum: PreoperationalParameterCategory,
    example: PreoperationalParameterCategory.SAFETY,
  })
  @IsEnum(PreoperationalParameterCategory)
  category: PreoperationalParameterCategory;

  @ApiProperty({
    description: 'Si el parámetro es requerido',
    example: true,
  })
  @IsBoolean()
  required: boolean;

  @ApiProperty({
    description: 'Si el parámetro es crítico (MALO genera alerta fuerte)',
    example: true,
  })
  @IsBoolean()
  critical: boolean;

  @ApiProperty({
    description:
      'Orden visual en el checklist (0, 1, 2...). Se usará para ordenar los ítems',
    required: false,
    example: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;
}

export class CreatePreoperationalChecklistTemplateDto {
  @ApiProperty({
    description:
      'Tipo lógico de herramienta en MAYÚSCULAS, ej: ESCALERA, PULIDORA, HERRAMIENTA GENERAL',
    example: 'ESCALERA',
  })
  @IsString()
  toolType: string;

  @ApiProperty({
    description: 'Categoría de la herramienta, ej: HERRAMIENTAS, INSTRUMENTOS',
    example: 'HERRAMIENTAS',
  })
  @IsString()
  toolCategory: string;

  @ApiProperty({
    description: 'Tiempo estimado en minutos para realizar el checklist',
    example: 10,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedTime?: number;

  @ApiProperty({
    description: 'Instrucciones adicionales para el checklist',
    required: false,
    example: 'Realizar la inspección antes de cada uso.',
  })
  @IsString()
  @IsOptional()
  additionalInstructions?: string;

  @ApiProperty({
    description: 'Lista de herramientas/equipos requeridos',
    required: false,
    example: ['Guantes de seguridad', 'Lentes de seguridad'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiresTools?: string[];

  @ApiProperty({
    description: 'Parámetros que componen el checklist',
    type: [CreatePreoperationalChecklistParameterDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePreoperationalChecklistParameterDto)
  parameters: CreatePreoperationalChecklistParameterDto[];
}