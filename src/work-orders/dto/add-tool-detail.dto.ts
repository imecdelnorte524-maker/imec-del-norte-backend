import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToolDetailDto {
  @ApiProperty({
    example: 1,
    description: 'ID del herramienta',
  })
  @IsNotEmpty({ message: 'El ID del herramienta es requerido' })
  @IsNumber({}, { message: 'El ID del herramienta debe ser un número' })
  herramientaId: number;

  @ApiProperty({
    example: '4 horas',
    description: 'Tiempo de uso del herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El tiempo de uso debe ser una cadena de texto' })
  tiempoUso?: string;

  @ApiProperty({
    example: 'Equipo funcionando correctamente',
    description: 'Comentarios sobre el uso del herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Los comentarios de uso deben ser una cadena de texto' })
  comentariosUso?: string;
}