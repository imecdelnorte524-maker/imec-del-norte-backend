import { IsNotEmpty, IsString, IsNumber, IsOptional, Min, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ToolType, ToolStatus } from '../../shared/enums/inventory.enum';

export class CreateToolDto {
  @ApiProperty({
    example: 'Multímetro Digital',
    description: 'Nombre del herramienta',
  })
  @IsNotEmpty({ message: 'El nombre del herramienta es requerido' })
  @IsString({ message: 'El nombre del herramienta debe ser una cadena de texto' })
  nombre: string;

  @ApiProperty({
    example: 'Fluke',
    description: 'Marca del herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La marca debe ser una cadena de texto' })
  marca?: string;

  @ApiProperty({
    example: 'FLK123456',
    description: 'Número de serie del herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El serial debe ser una cadena de texto' })
  serial?: string;

  @ApiProperty({
    example: '87V',
    description: 'Modelo del herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El modelo debe ser una cadena de texto' })
  modelo?: string;

  @ApiProperty({
    example: 'True RMS, 6000 counts',
    description: 'Características técnicas del herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Las características técnicas deben ser una cadena de texto' })
  caracteristicasTecnicas?: string;

  @ApiProperty({
    example: 'Equipo en buen estado, calibrado recientemente',
    description: 'Observaciones del herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto' })
  observacion?: string;

  @ApiProperty({
    example: 'Instrumento',
    description: 'Tipo de herramienta',
    enum: ToolType,
  })
  @IsNotEmpty({ message: 'El tipo de herramienta es requerido' })
  @IsEnum(ToolType, { message: 'El tipo debe ser un valor válido' })
  tipo: ToolType;

  @ApiProperty({
    example: 'Disponible',
    description: 'Estado del herramienta',
    enum: ToolStatus,
  })
  @IsNotEmpty({ message: 'El estado del herramienta es requerido' })
  @IsEnum(ToolStatus, { message: 'El estado debe ser un valor válido' })
  estado: ToolStatus;

  @ApiProperty({
    example: 1200000.00,
    description: 'Valor unitario del herramienta',
  })
  @IsNotEmpty({ message: 'El valor unitario es requerido' })
  @IsNumber({}, { message: 'El valor unitario debe ser un número' })
  @Min(0, { message: 'El valor unitario no puede ser negativo' })
  valorUnitario: number;

  @ApiProperty({
    example: 'https://example.com/foto-herramienta.jpg',
    description: 'URL de la foto del herramienta',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La URL de la foto debe ser una cadena de texto' })
  fotoUrl?: string;

  // NUEVO: Campos para el inventario asociado
  @ApiProperty({
    example: 'Almacén Principal - Estante A',
    description: 'Ubicación del herramienta en inventario',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La ubicación debe ser una cadena de texto' })
  ubicacion?: string;
  
  @ApiProperty({
    example: '1',
    description: 'ID del inventario asociado al herramienta (se genera automáticamente)',
    required: false,
  })
  @Transform(({ value }) => {
    // Convertir cadena vacía, null o undefined a undefined
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    // Si es un string numérico, convertirlo a número
    if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
      return Number(value);
    }
    // Si ya es un número, devolverlo tal cual
    if (typeof value === 'number') {
      return value;
    }
    // Para cualquier otro caso, devolver undefined
    return undefined;
  })
  @IsOptional()
  @IsNumber({}, { message: 'El inventarioId debe ser un número' })
  inventarioId?: number;
}