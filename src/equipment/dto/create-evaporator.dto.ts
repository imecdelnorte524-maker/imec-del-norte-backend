import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMotorDto } from './create-motor.dto';

export class CreateEvaporatorDto {
  @ApiPropertyOptional({ example: 'Daikin' })
  @IsOptional()
  @IsString()
  marca?: string;

  @ApiPropertyOptional({ example: 'FTXS50K' })
  @IsOptional()
  @IsString()
  modelo?: string;

  @ApiPropertyOptional({ example: 'EV-987654321' })
  @IsOptional()
  @IsString()
  serial?: string;

  @ApiPropertyOptional({ example: '18000 BTU' })
  @IsOptional()
  @IsString()
  capacidad?: string;

  @ApiPropertyOptional({ example: 'R-410A' })
  @IsOptional()
  @IsString()
  tipoRefrigerante?: string;

  @ApiPropertyOptional({
    type: [CreateMotorDto],
    description: 'Lista de motores asociados a este evaporador',
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateMotorDto)
  motors?: CreateMotorDto[];
}