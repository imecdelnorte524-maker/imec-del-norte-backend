// src/sg-sst/dto/authorize-height-work.dto.ts
import { IsBoolean, IsOptional, IsString, IsNotEmpty, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SignerType } from './sign-form.dto';

export class AuthorizeHeightWorkDto {
  @ApiProperty({
    description: 'Nombre del autorizador SST',
    example: 'María Rodríguez López'
  })
  @IsNotEmpty()
  @IsString()
  authorizerName: string;

  @ApiProperty({
    description: 'Identificación del autorizador SST',
    example: '987654321'
  })
  @IsNotEmpty()
  @IsString()
  authorizerIdentification: string;

  @ApiProperty({
    description: 'Verificación de condiciones físicas',
    example: true
  })
  @IsBoolean()
  physicalCondition: boolean;

  @ApiProperty({
    description: 'Verificación de instrucciones recibidas',
    example: true
  })
  @IsBoolean()
  instructionsReceived: boolean;

  @ApiProperty({
    description: 'Verificación de aptitud para trabajo en alturas',
    example: true
  })
  @IsBoolean()
  fitForHeightWork: boolean;

  @ApiProperty({
    description: 'Datos de la firma digital en base64',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
  })
  @IsNotEmpty()
  @IsString()
  signatureData: string;

  @ApiProperty({
    description: 'Tipo de firmante',
    enum: SignerType,
    example: SignerType.SST
  })
  @IsNotEmpty()
  signerType: SignerType;

  @ApiProperty({
    description: 'ID del usuario que firma',
    example: 2
  })
  @IsNotEmpty()
  userId: number;

  @ApiProperty({
    description: 'Nombre del usuario que firma',
    example: 'María Rodríguez López'
  })
  @IsNotEmpty()
  @IsString()
  userName: string;

  @ApiProperty({
    description: 'Fecha de autorización (opcional, se usará la fecha actual si no se proporciona)',
    example: '2024-01-15',
    required: false
  })
  @IsOptional()
  @IsString()
  authorizationDate?: string;

  @ApiProperty({
    description: 'Hora de autorización (opcional)',
    example: '14:30',
    required: false
  })
  @IsOptional()
  @IsString()
  authorizationTime?: string;
}