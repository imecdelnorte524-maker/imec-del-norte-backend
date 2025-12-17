import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class AddEquipmentPhotoDto {
  @ApiProperty({
    example: 'https://mi-servidor.com/fotos/equipo1-1.jpg',
    description: 'URL de la foto del equipo',
  })
  @IsNotEmpty({ message: 'La URL de la foto es requerida' })
  @IsString({ message: 'La URL debe ser una cadena de texto' })
  url: string;

  @ApiProperty({
    example: 'Vista frontal del equipo',
    description: 'Descripción de la foto',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  description?: string;
}