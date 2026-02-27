// src/tools/dto/create-tools.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ToolStatus, ToolType } from '../../shared';

export class CreateToolDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  marca?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  serial?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  modelo?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  caracteristicasTecnicas?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  observacion?: string;

  @ApiProperty({ enum: ToolType, default: ToolType.HERRAMIENTA })
  @IsEnum(ToolType)
  @IsOptional()
  tipo?: ToolType;

  @ApiProperty({ enum: ToolStatus, default: ToolStatus.DISPONIBLE })
  @IsEnum(ToolStatus)
  @IsOptional()
  estado?: ToolStatus;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  valorUnitario: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  bodegaId?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  ubicacion?: string;
}
