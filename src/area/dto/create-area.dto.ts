// src/area/dto/create-area.dto.ts
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAreaDto {
  @ApiProperty({ example: 'Área de Producción', description: 'Nombre del área' })
  @IsNotEmpty({ message: 'El nombre del área es requerido' })
  @IsString({ message: 'El nombre del área debe ser una cadena de texto' })
  nombreArea: string;

  @ApiProperty({ example: 1, description: 'ID del cliente al que pertenece el área' })
  @IsNotEmpty({ message: 'El ID del cliente es requerido' })
  @IsNumber({}, { message: 'El ID del cliente debe ser un número' })
  clienteId: number;
}
