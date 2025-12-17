// src/users/dto/verify-reset-token.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsJWT } from 'class-validator';

export class VerifyResetTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT token para verificar',
  })
  @IsNotEmpty({ message: 'El token es requerido' })
  @IsJWT()
  token: string;
}