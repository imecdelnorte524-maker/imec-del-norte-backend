import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubAreaDto {
  @ApiProperty({
    example: 'Línea 1 de Producción',
    description: 'Nombre de la subárea',
  })
  @IsNotEmpty({ message: 'El nombre de la subárea es requerido' })
  @IsString({ message: 'El nombre de la subárea debe ser una cadena de texto' })
  nombreSubArea: string;

  @ApiProperty({
    example: 1,
    description: 'ID del área a la que pertenece la subárea',
  })
  @IsNotEmpty({ message: 'El ID del área es requerido' })
  @IsNumber({}, { message: 'El ID del área debe ser un número' })
  areaId: number;

  @ApiProperty({
    example: 2,
    description: 'ID de la subárea padre (opcional para jerarquía)',
    required: false,
  })
  @IsOptional()
  @IsNumber(
    {},
    { message: 'El ID de la subárea padre debe ser un número' },
  )
  parentSubAreaId?: number;
}