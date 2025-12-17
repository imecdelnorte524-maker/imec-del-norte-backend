import { IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'admin',
    description: 'Nombre de usuario',
  })
  @IsNotEmpty({ message: 'El nombre de usuario es requerido' })
  username: string;

  @ApiProperty({
    example: 'Admin123!',
    description: 'Contraseña del usuario',
    minLength: 6,
  })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}