import { Controller, Get, Post, Body, Param, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MaintenanceTypesService } from './maintenance-types.service';
import { CreateMaintenanceTypeDto } from './dto/create-maintenance-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('maintenance-types')
@Controller('maintenance-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MaintenanceTypesController {
  constructor(private readonly service: MaintenanceTypesService) {}

  @Post()
   
  @ApiOperation({ summary: 'Crear nuevo tipo de mantenimiento (Solo Admin)' })
  create(@Body() dto: CreateMaintenanceTypeDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tipos de mantenimiento activos (Público autenticado)' })
  findAll() {
    return this.service.findAll();
  }

  @Delete(':id')
   
  @ApiOperation({ summary: 'Desactivar un tipo de mantenimiento' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}