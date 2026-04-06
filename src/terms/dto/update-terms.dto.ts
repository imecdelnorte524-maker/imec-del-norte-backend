import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateTermsDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  items?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
