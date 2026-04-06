import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { TermsService } from './terms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTermsDto } from './dto/create-terms.dto';
import { UpdateTermsDto } from './dto/update-terms.dto';
import { TermsType } from '../shared';

@Controller('terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) { }

  private mapRouteType(type: string): TermsType {
    const normalized = type.trim().toLowerCase();

    switch (normalized) {
      case 'dataprivacy':
      case 'data_privacy':
        return TermsType.DATA_PRIVACY;

      case 'ats':
        return TermsType.ATS;

      case 'height_work':
      case 'heights':
        return TermsType.HEIGHT_WORK;

      case 'preoperational_form':
      case 'preoperational':
        return TermsType.PREOPERATIONAL_FORM;

      default:
        throw new BadRequestException(`Tipo de términos inválido: ${type}`);
    }
  }

  @Get()
  async findAll() {
    return this.termsService.findAll();
  }

  @Get(':type')
  async findByType(@Param('type') type: string) {
    return this.termsService.findByType(this.mapRouteType(type));
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(@Body() createTermsDto: CreateTermsDto, @Request() req) {
    return this.termsService.create(createTermsDto, req.user.id);
  }

  @Put(':type')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(
    @Param('type') type: string,
    @Body() updateTermsDto: UpdateTermsDto,
    @Request() req,
  ) {
    return this.termsService.update(
      this.mapRouteType(type),
      updateTermsDto,
      req.user.id,
    );
  }

  @Delete(':type')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async delete(@Param('type') type: string) {
    return this.termsService.delete(this.mapRouteType(type));
  }
}