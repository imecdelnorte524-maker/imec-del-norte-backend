import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkOrderDto {
  @ApiProperty({
    example: 1,
    description: 'ID del servicio',
  })
  @IsNotEmpty({ message: 'El ID del servicio es requerido' })
  @IsNumber({}, { message: 'El ID del servicio debe ser un número' })
  servicioId: number;

  @ApiProperty({
    example: 3,
    description:
      'ID del usuario cliente (persona de contacto). ' +
      'Si no se envía, se utilizará el usuario contacto de la empresa seleccionada (para Administrador), ' +
      'o el usuario autenticado (para Cliente).',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID del cliente debe ser un número' })
  clienteId?: number;

  @ApiProperty({
    example: 2,
    description: 'ID del técnico asignado (opcional, se puede asignar luego)',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID del técnico debe ser un número' })
  tecnicoId?: number;

  @ApiProperty({
    example: 5,
    description:
      'ID del cliente empresa (tabla clientes). ' +
      'Obligatorio para Administrador. Para Cliente se toma automáticamente la empresa donde él es usuario de contacto.',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID del cliente empresa debe ser un número' })
  clienteEmpresaId?: number;

  @ApiProperty({
    example: 10,
    description:
      'ID del equipo (hoja de vida) asociado a la orden (opcional, para mantenimientos)',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID del equipo debe ser un número' })
  equipoId?: number;

  @ApiProperty({
    example: '2024-01-15T08:00:00.000Z',
    description: 'Fecha de inicio programada (opcional)',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio debe ser una fecha válida' })
  fechaInicio?: Date;

  @ApiProperty({
    example: 'Instalación urgente requerida',
    description: 'Comentarios adicionales (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Los comentarios deben ser una cadena de texto' })
  comentarios?: string;
}