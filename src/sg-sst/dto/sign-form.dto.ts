// src/sg-sst/dto/sign-form.dto.ts
import { IsEnum, IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SignerType {
  TECHNICIAN = 'TECHNICIAN',
  SST = 'SST',
}

export class SignFormDto {
  @ApiProperty({
    description: 'Tipo de firmante',
    enum: SignerType,
    example: SignerType.TECHNICIAN,
  })
  @IsEnum(SignerType)
  signerType: SignerType;

  @ApiProperty({
    description:
      'ID del usuario que firma (NO se usa para seguridad, solo legacy)',
    example: 2,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  userId?: number;

  @ApiProperty({
    description:
      'Nombre del usuario que firma (NO se usa para seguridad, solo display)',
    example: 'Ana López',
    required: false,
  })
  @IsString()
  @IsOptional()
  userName?: string;

  @ApiProperty({
    description: 'Datos de la firma digital (base64)',
    required: false,
    example: 'data:image/png;base64,iVBORw0KGgo...',
  })
  @IsString()
  @IsOptional()
  signatureData?: string;

  @ApiProperty({
    description: 'Código OTP enviado por correo al usuario',
    example: '123456',
  })
  @IsString()
  otpCode: string;
}
