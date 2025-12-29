import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsJWT, IsNotEmpty, MinLength, Matches } from 'class-validator';

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
    minLength: 8,
  })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    {
      message:
        'La contraseña debe incluir mayúsculas, minúsculas, números y un carácter especial',
    },
  )
  password: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT token para resetear contraseña',
  })
  @IsNotEmpty({ message: 'El token es requerido' })
  @IsJWT()
  token: string;
}