import { PartialType } from '@nestjs/mapped-types';
import { CreateAtsDto } from './create-ats.dto';
import { CreateHeightWorkDto } from './create-height-work.dto';
import { CreatePreoperationalDto } from './create-preoperational.dto';

export class UpdateAtsDto extends PartialType(CreateAtsDto) {}
export class UpdateHeightWorkDto extends PartialType(CreateHeightWorkDto) {}
export class UpdatePreoperationalDto extends PartialType(CreatePreoperationalDto) {}