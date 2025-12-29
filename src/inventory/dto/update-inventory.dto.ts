// update-inventory.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateInventoryDto } from './create-inventory.dto';
import { IsOptional, IsNumber, Min, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SupplyStatus, ToolStatus } from 'src/shared/enums';

export class UpdateInventoryDto extends PartialType(CreateInventoryDto) {
  @ApiProperty({
    example: 15.5,
    description: 'Cantidad actual en inventario',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'La cantidad actual debe ser un número' })
  @Min(0, { message: 'La cantidad actual no puede ser negativa' })
  cantidadActual?: number;

  @ApiProperty({
    example: 'Almacén Principal - Estante B',
    description: 'Ubicación del item en el inventario',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La ubicación debe ser una cadena de texto' })
  ubicacion?: string;

  @ApiProperty({
    example: 'Disponible',
    description: 'Estado del item',
    enum: [...Object.values(SupplyStatus), ...Object.values(ToolStatus)],
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El estado debe ser una cadena de texto' })
  estado?: string;
}