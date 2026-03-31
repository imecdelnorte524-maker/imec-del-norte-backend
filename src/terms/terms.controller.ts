// src/controllers/terms.controller.ts
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
} from '@nestjs/common';
import { TermsService } from './terms.service';
import { TermsType } from './entities/terms.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTermsDto } from './dto/create-terms.dto';
import { UpdateTermsDto } from './dto/update-terms.dto';

@Controller('terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Get()
  async findAll() {
    return this.termsService.findAll();
  }

  @Get(':type')
  async findByType(@Param('type') type: TermsType) {
    return this.termsService.findByType(type);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(@Body() createTermsDto: CreateTermsDto, @Request() req) {
    return this.termsService.create(createTermsDto, req.user.id);
  }

  @Put(':type')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(
    @Param('type') type: TermsType,
    @Body() updateTermsDto: UpdateTermsDto,
    @Request() req,
  ) {
    return this.termsService.update(type, updateTermsDto, req.user.id);
  }

  @Delete(':type')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async delete(@Param('type') type: TermsType) {
    return this.termsService.delete(type);
  }
}
