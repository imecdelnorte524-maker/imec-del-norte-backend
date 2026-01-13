import { PartialType } from '@nestjs/swagger';
import { CreateAirConditionerTypeDto } from './create-air-conditioner-type.dto';

export class UpdateAirConditionerTypeDto extends PartialType(
  CreateAirConditionerTypeDto,
) {}