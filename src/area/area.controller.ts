// src/area/area.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AreaService } from './area.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('areas')
@Controller('areas')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AreaController {
  constructor(private readonly areaService: AreaService) {}

  @Post()
  @Roles('Administrador', 'Secretaria')
  @ApiOperation({ summary: 'Crear área', description: 'Crea una nueva área' })
  @ApiResponse({ status: 201, description: 'Área creada exitosamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe un área con este nombre para este cliente' })
  async create(@Body() createAreaDto: CreateAreaDto) {
    const area = await this.areaService.create(createAreaDto);
    return {
      message: 'Área creada exitosamente',
      data: area,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las áreas', description: 'Obtiene la lista de todas las áreas' })
  @ApiQuery({ name: 'clienteId', required: false, description: 'Filtrar por ID de cliente' })
  @ApiResponse({ status: 200, description: 'Lista de áreas obtenida exitosamente' })
  async findAll(@Query('clienteId') clienteId?: string) {
    let areas;
    
    if (clienteId) {
      areas = await this.areaService.findByClientId(parseInt(clienteId));
    } else {
      areas = await this.areaService.findAll();
    }
    
    return {
      message: 'Áreas obtenidas exitosamente',
      data: areas,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener área por ID', description: 'Obtiene un área específica por su ID' })
  @ApiResponse({ status: 200, description: 'Área obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Área no encontrada' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const area = await this.areaService.findOne(id);
    return {
      message: 'Área obtenida exitosamente',
      data: area,
    };
  }

  @Get(':id/subareas-count')
  @ApiOperation({ summary: 'Contar subáreas de un área', description: 'Obtiene el número de subáreas de un área' })
  @ApiResponse({ status: 200, description: 'Conteo obtenido exitosamente' })
  @ApiResponse({ status: 404, description: 'Área no encontrada' })
  async countSubAreas(@Param('id', ParseIntPipe) id: number) {
    const count = await this.areaService.countSubAreas(id);
    return {
      message: 'Conteo de subáreas obtenido exitosamente',
      data: { count, areaId: id },
    };
  }

  @Get(':id/with-subareas')
  @ApiOperation({ summary: 'Obtener área con subáreas', description: 'Obtiene un área con todas sus subáreas' })
  @ApiResponse({ status: 200, description: 'Área obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Área no encontrada' })
  async getAreaWithSubAreas(@Param('id', ParseIntPipe) id: number) {
    const area = await this.areaService.getAreaWithSubAreas(id);
    return {
      message: 'Área con subáreas obtenida exitosamente',
      data: area,
    };
  }

  @Patch(':id')
  @Roles('Administrador', 'Secretaria')
  @ApiOperation({ summary: 'Actualizar área', description: 'Actualiza un área existente' })
  @ApiResponse({ status: 200, description: 'Área actualizada exitosamente' })
  @ApiResponse({ status: 404, description: 'Área no encontrada' })
  @ApiResponse({ status: 409, description: 'Ya existe un área con este nombre para este cliente' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAreaDto: UpdateAreaDto,
  ) {
    const area = await this.areaService.update(id, updateAreaDto);
    return {
      message: 'Área actualizada exitosamente',
      data: area,
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({ summary: 'Eliminar área', description: 'Elimina un área permanentemente' })
  @ApiResponse({ status: 200, description: 'Área eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Área no encontrado' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.areaService.remove(id);
    return {
      message: 'Área eliminada exitosamente',
    };
  }
}