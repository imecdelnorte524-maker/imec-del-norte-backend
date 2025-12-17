// src/auth/dto/recovery-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsJWT, IsNotEmpty, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({
    example: 'admin@imec.com',
    description: 'Correo electrónico del usuario',
  })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'NuevaPassword123!',
    description: 'Nueva contraseña',
    minLength: 6,
  })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT token para resetear contraseña',
  })
  @IsNotEmpty({ message: 'El token es requerido' })
  @IsJWT()
  token: string;
}