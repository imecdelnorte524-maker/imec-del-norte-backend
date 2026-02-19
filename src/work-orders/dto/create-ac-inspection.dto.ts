// src/work-orders/dto/create-ac-inspection.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAcInspectionDto {
  @ApiProperty({
    example: 10,
    description: 'Id del equipo asociado a la inspección',
  })
  @IsNumber()
  @IsNotEmpty()
  equipmentId: number;

  // ---- EVAPORADORA ----
  @ApiProperty({
    example: 12.5,
    description: 'Temperatura de suministro (evaporadora)',
  })
  @IsNumber()
  evapTempSupply: number;

  @ApiProperty({
    example: 20.1,
    description: 'Temperatura de retorno (evaporadora)',
  })
  @IsNumber()
  evapTempReturn: number;

  @ApiProperty({
    example: 24.0,
    description: 'Temperatura ambiente (evaporadora)',
  })
  @IsNumber()
  evapTempAmbient: number;

  @ApiProperty({
    example: 30.0,
    description: 'Temperatura exterior (evaporadora)',
  })
  @IsNumber()
  evapTempOutdoor: number;

  @ApiProperty({ example: 950, description: 'RPM del motor (evaporadora)' })
  @IsNumber()
  evapMotorRpm: number;

  @ApiProperty({
    example: 35,
    description: 'Microfaradios (evaporadora)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  evapMicrofarads?: number;

  // ---- CONDENSADORA ----
  @ApiProperty({ example: 250, description: 'Presión alta (condensadora)' })
  @IsNumber()
  condHighPressure: number;

  @ApiProperty({ example: 70, description: 'Presión baja (condensadora)' })
  @IsNumber()
  condLowPressure: number;

  @ApiProperty({ example: 8.5, description: 'Amperaje (condensadora)' })
  @IsNumber()
  condAmperage: number;

  @ApiProperty({ example: 220, description: 'Voltaje (condensadora)' })
  @IsNumber()
  condVoltage: number;

  @ApiProperty({
    example: 28,
    description: 'Temperatura de entrada (condensadora)',
  })
  @IsNumber()
  condTempIn: number;

  @ApiProperty({
    example: 90,
    description: 'Temperatura de descarga (condensadora)',
  })
  @IsNumber()
  condTempDischarge: number;

  @ApiProperty({ example: 1200, description: 'RPM del motor (condensadora)' })
  @IsNumber()
  condMotorRpm: number;

  @ApiProperty({
    example: 40,
    description: 'Microfaradios (condensadora)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  condMicrofarads?: number;

  @ApiProperty({
    example: 5,
    description: '"Ohmio" del compresor',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  compressorOhmio?: number;

  @ApiProperty({
    example: 'Equipo con leve suciedad en serpentines',
    required: false,
  })
  @IsOptional()
  @IsString()
  observation?: string;
}
