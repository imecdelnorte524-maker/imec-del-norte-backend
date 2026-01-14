// src/unit-measure/dto/create-unit-measure.dto.ts
import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUnitMeasureDto {
  @ApiProperty({
    example: 'Metro',
    description: 'Nombre único de la unidad de medida',
  })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El nombre no puede exceder los 50 caracteres' })
  nombre: string;

  @ApiProperty({
    example: 'm',
    description: 'Abreviatura de la unidad (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La abreviatura debe ser una cadena de texto' })
  @MaxLength(10, { message: 'La abreviatura no puede exceder los 10 caracteres' })
  abreviatura?: string;
}