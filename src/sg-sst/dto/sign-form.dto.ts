import { IsEnum, IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SignerType {
  TECHNICIAN = 'TECHNICIAN',
  SST = 'SST'
}

export class SignFormDto {
  @ApiProperty({ 
    description: 'Tipo de firmante', 
    enum: SignerType, 
    example: SignerType.TECHNICIAN 
  })
  @IsEnum(SignerType)
  signerType: SignerType;

  @ApiProperty({ description: 'ID del usuario que firma', example: 2 })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: 'Nombre del usuario que firma', example: 'Ana López' })
  @IsString()
  userName: string;

  @ApiProperty({ description: 'Datos de la firma digital (base64)', required: false, example: 'data:image/png;base64,iVBORw0KGgo...' })
  @IsString()
  @IsOptional()
  signatureData?: string;
}