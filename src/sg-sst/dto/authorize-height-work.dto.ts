// src/sg-sst/dto/authorize-height-work.dto.ts
import { IsBoolean, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthorizeHeightWorkDto {
  @ApiProperty({
    description: 'Nombre del autorizador SST',
    example: 'María Rodríguez López',
  })
  @IsNotEmpty()
  @IsString()
  authorizerName: string;

  @ApiProperty({
    description: 'Identificación del autorizador SST',
    example: '987654321',
  })
  @IsNotEmpty()
  @IsString()
  authorizerIdentification: string;

  @ApiProperty({
    description: 'Verificación de condiciones físicas',
    example: true,
  })
  @IsBoolean()
  physicalCondition: boolean;

  @ApiProperty({
    description: 'Verificación de instrucciones recibidas',
    example: true,
  })
  @IsBoolean()
  instructionsReceived: boolean;

  @ApiProperty({
    description: 'Verificación de aptitud para trabajo en alturas',
    example: true,
  })
  @IsBoolean()
  fitForHeightWork: boolean;
}
