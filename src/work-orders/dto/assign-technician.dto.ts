import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class AssignTechnicianDto {
  @ApiProperty({
    example: 4,
    description: 'ID del técnico que se va a asignar a la orden',
  })
  @IsNotEmpty({ message: 'El ID del técnico es requerido' })
  @IsNumber({}, { message: 'El ID del técnico debe ser un número' })
  tecnicoId: number;
}