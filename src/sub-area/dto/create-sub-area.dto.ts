// src/sub-area/dto/create-sub-area.dto.ts
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubAreaDto {
  @ApiProperty({ example: 'Línea 1 de Producción', description: 'Nombre de la subárea' })
  @IsNotEmpty({ message: 'El nombre de la subárea es requerido' })
  @IsString({ message: 'El nombre de la subárea debe ser una cadena de texto' })
  nombreSubArea: string;

  @ApiProperty({ example: 1, description: 'ID del área a la que pertenece la subárea' })
  @IsNotEmpty({ message: 'El ID del área es requerido' })
  @IsNumber({}, { message: 'El ID del área debe ser un número' })
  areaId: number;
}
