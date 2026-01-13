import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAirConditionerTypeDto {
  @ApiProperty({
    example: 'Minisplit Pared',
    description: 'Nombre del tipo de aire acondicionado',
  })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser texto' })
  name: string;

  @ApiProperty({
    example: true,
    description: '¿Tiene evaporador?',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Debe ser booleano' })
  hasEvaporator?: boolean = false;

  @ApiProperty({
    example: true,
    description: '¿Tiene condensadora?',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Debe ser booleano' })
  hasCondenser?: boolean = false;
}