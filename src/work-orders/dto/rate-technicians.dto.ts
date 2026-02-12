// src/work-orders/dto/rate-technicians.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SingleTechnicianRatingDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  technicianId: number;

  @ApiProperty({ example: 4.5, minimum: 0, maximum: 5 })
  @IsNumber()
  @Min(0)
  @Max(5)
  rating: number;
}

export class RateTechniciansDto {
  @ApiProperty({ type: [SingleTechnicianRatingDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SingleTechnicianRatingDto)
  ratings: SingleTechnicianRatingDto[];
}
