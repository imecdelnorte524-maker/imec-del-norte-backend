// src/sub-area/sub-area.controller.ts
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
import { SubAreaService } from './sub-area.service';
import { CreateSubAreaDto } from './dto/create-sub-area.dto';
import { UpdateSubAreaDto } from './dto/update-sub-area.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('sub-areas')
@Controller('sub-areas')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SubAreaController {
  constructor(private readonly subAreaService: SubAreaService) {}

  @Post()
  @Roles('Administrador', 'Secretaria')
  @ApiOperation({ summary: 'Crear subárea', description: 'Crea una nueva subárea' })
  @ApiResponse({ status: 201, description: 'Subárea creada exitosamente' })
  @ApiResponse({ status: 404, description: 'Área no encontrada' })
  @ApiResponse({ status: 409, description: 'Ya existe una subárea con este nombre para esta área' })
  async create(@Body() createSubAreaDto: CreateSubAreaDto) {
    const subArea = await this.subAreaService.create(createSubAreaDto);
    return {
      message: 'Subárea creada exitosamente',
      data: subArea,
    };
  }

  @Get()
  @Roles('Administrador', 'Secretaria', 'Técnico')
  @ApiOperation({ summary: 'Obtener todas las subáreas', description: 'Obtiene la lista de todas las subáreas' })
  @ApiQuery({ name: 'areaId', required: false, description: 'Filtrar por ID de área' })
  @ApiQuery({ name: 'clienteId', required: false, description: 'Filtrar por ID de cliente' })
  @ApiResponse({ status: 200, description: 'Lista de subáreas obtenida exitosamente' })
  async findAll(
    @Query('areaId') areaId?: string,
    @Query('clienteId') clienteId?: string,
  ) {
    let subAreas;
    
    if (areaId) {
      subAreas = await this.subAreaService.findByAreaId(parseInt(areaId));
    } else if (clienteId) {
      subAreas = await this.subAreaService.findByClientId(parseInt(clienteId));
    } else {
      subAreas = await this.subAreaService.findAll();
    }
    
    return {
      message: 'Subáreas obtenidas exitosamente',
      data: subAreas,
    };
  }

  @Get(':id')
  @Roles('Administrador', 'Secretaria', 'Técnico')
  @ApiOperation({ summary: 'Obtener subárea por ID', description: 'Obtiene una subárea específica por su ID' })
  @ApiResponse({ status: 200, description: 'Subárea obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Subárea no encontrada' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const subArea = await this.subAreaService.findOne(id);
    return {
      message: 'Subárea obtenida exitosamente',
      data: subArea,
    };
  }

  @Get(':id/hierarchy')
  @Roles('Administrador', 'Secretaria', 'Técnico')
  @ApiOperation({ 
    summary: 'Obtjer jerarquía completa', 
    description: 'Obtiene la subárea con su área y cliente correspondientes' 
  })
  @ApiResponse({ status: 200, description: 'Jerarquía obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Subárea no encontrada' })
  async getHierarchy(@Param('id', ParseIntPipe) id: number) {
    const hierarchy = await this.subAreaService.getHierarchy(id);
    return {
      message: 'Jerarquía obtenida exitosamente',
      data: hierarchy,
    };
  }

  @Patch(':id')
  @Roles('Administrador', 'Secretaria')
  @ApiOperation({ summary: 'Actualizar subárea', description: 'Actualiza una subárea existente' })
  @ApiResponse({ status: 200, description: 'Subárea actualizada exitosamente' })
  @ApiResponse({ status: 404, description: 'Subárea no encontrada' })
  @ApiResponse({ status: 409, description: 'Ya existe una subárea con este nombre para esta área' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSubAreaDto: UpdateSubAreaDto,
  ) {
    const subArea = await this.subAreaService.update(id, updateSubAreaDto);
    return {
      message: 'Subárea actualizada exitosamente',
      data: subArea,
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({ summary: 'Eliminar subárea', description: 'Elimina una subárea permanentemente' })
  @ApiResponse({ status: 200, description: 'Subárea eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Subárea no encontrada' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.subAreaService.remove(id);
    return {
      message: 'Subárea eliminada exitosamente',
    };
  }
}