import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkOrderDto {
  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsNumber()
  servicioId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  clienteId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  tecnicoId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  clienteEmpresaId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fechaInicio?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comentarios?: string;
}