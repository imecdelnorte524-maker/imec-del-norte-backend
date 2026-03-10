import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateAcInspectionDto {
  @ApiProperty({
    example: 10,
    description: 'Id del equipo asociado a la inspección',
  })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  equipmentId: number;

  // ---- EVAPORADORA ----
  @ApiProperty({
    example: 12.5,
    description: 'Temperatura de suministro (evaporadora)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  evapTempSupply: number;

  @ApiProperty({
    example: 20.1,
    description: 'Temperatura de retorno (evaporadora)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  evapTempReturn: number;

  @ApiProperty({
    example: 24.0,
    description: 'Temperatura ambiente (evaporadora)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  evapTempAmbient: number;

  @ApiProperty({
    example: 30.0,
    description: 'Temperatura exterior (evaporadora)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  evapTempOutdoor: number;

  @ApiProperty({ example: 950, description: 'RPM del motor (evaporadora)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  evapMotorRpm: number;

  @ApiProperty({
    example: 35,
    description: 'Microfaradios (evaporadora)',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  evapMicrofarads?: number;

  // ---- CONDENSADORA ----
  @ApiProperty({ example: 250, description: 'Presión alta (condensadora)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  condHighPressure: number;

  @ApiProperty({ example: 70, description: 'Presión baja (condensadora)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  condLowPressure: number;

  @ApiProperty({ example: 8.5, description: 'Amperaje (condensadora)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  condAmperage: number;

  @ApiProperty({ example: 220, description: 'Voltaje (condensadora)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  condVoltage: number;

  @ApiProperty({
    example: 28,
    description: 'Temperatura de entrada (condensadora)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  condTempIn: number;

  @ApiProperty({
    example: 90,
    description: 'Temperatura de descarga (condensadora)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  condTempDischarge: number;

  @ApiProperty({ example: 1200, description: 'RPM del motor (condensadora)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  condMotorRpm: number;

  @ApiProperty({
    example: 40,
    description: 'Microfaradios (condensadora)',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  condMicrofarads?: number;

  @ApiProperty({
    example: 5,
    description: '"Ohmio" del compresor',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  compressorOhmio?: number;

  @ApiProperty({
    example: 'Equipo con leve suciedad en serpentines',
    required: false,
  })
  @IsOptional()
  @IsString()
  observation?: string;
}
