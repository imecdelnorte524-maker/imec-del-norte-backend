// src/tools/dto/delete-tool.dto.ts
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ToolEliminationReason } from '../../shared/enums/inventory.enum';

export class DeleteToolDto {
  @ApiProperty({
    example: 'Dañado',
    description: 'Motivo de la eliminación',
    enum: ToolEliminationReason,
  })
  @IsEnum(ToolEliminationReason, { message: 'El motivo debe ser un valor válido' })
  motivo: ToolEliminationReason;

  @ApiProperty({
    example: 'Se cayó y se rompió la pantalla LCD',
    description: 'Observación adicional sobre la eliminación',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto' })
  @MaxLength(500, { message: 'La observación no puede exceder los 500 caracteres' })
  observacion?: string;
}