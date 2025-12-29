import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'MiPasswordActual123!',
    description: 'Contraseña actual del usuario',
  })
  @IsNotEmpty({ message: 'La contraseña actual es requerida' })
  currentPassword: string;

  @ApiProperty({
    example: 'NuevaPassword123!',
    description: 'Nueva contraseña',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'La nueva contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    {
      message:
        'La contraseña debe incluir mayúsculas, minúsculas, números y un carácter especial',
    },
  )
  newPassword: string;
}