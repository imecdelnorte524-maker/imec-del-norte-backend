import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMotorDto } from './create-motor.dto';
import { CreateCompressorDto } from './create-compressor.dto';

export class CreateCondenserDto {
  @ApiPropertyOptional({ example: 'Daikin' })
  @IsOptional()
  @IsString()
  marca?: string;

  @ApiPropertyOptional({ example: 'RXS50K' })
  @IsOptional()
  @IsString()
  modelo?: string;

  @ApiPropertyOptional({ example: 'CN-456789123' })
  @IsOptional()
  @IsString()
  serial?: string;

  @ApiPropertyOptional({ example: '18000 BTU' })
  @IsOptional()
  @IsString()
  capacidad?: string;

  @ApiPropertyOptional({ example: '9A' })
  @IsOptional()
  @IsString()
  amperaje?: string;

  @ApiPropertyOptional({ example: '220V' })
  @IsOptional()
  @IsString()
  voltaje?: string;

  @ApiPropertyOptional({ example: 'R-410A' })
  @IsOptional()
  @IsString()
  tipoRefrigerante?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  numeroFases?: string;

  @ApiPropertyOptional({ example: '320 PSI' })
  @IsOptional()
  @IsString()
  presionAlta?: string;

  @ApiPropertyOptional({ example: '120 PSI' })
  @IsOptional()
  @IsString()
  presionBaja?: string;

  @ApiPropertyOptional({ example: '3.5 HP' })
  @IsOptional()
  @IsString()
  hp?: string;

  @ApiPropertyOptional({
    type: [CreateMotorDto],
    description: 'Lista de motores asociados a esta condensadora',
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateMotorDto)
  motors?: CreateMotorDto[];

  @ApiPropertyOptional({
    type: [CreateCompressorDto],
    description: 'Lista de compresores asociados a esta condensadora',
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateCompressorDto)
  compressors?: CreateCompressorDto[];
}