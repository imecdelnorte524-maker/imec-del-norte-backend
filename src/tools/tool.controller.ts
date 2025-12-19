import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ToolService } from './tool.service';
import { CreateToolDto } from './dto/create-tools.dto';
import { UpdateToolDto } from './dto/update-tools.dto';
import { ToolResponseDto } from './dto/tools-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Tool } from './entities/tool.entity';

@ApiTags('tool')
@Controller('tool')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ToolController {
  constructor(private readonly toolService: ToolService) {}

  @Post()
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Crear herramienta',
    description: 'Crea una nueva herramienta (Administrador y Técnico)',
  })
  @ApiBody({ type: CreateToolDto })
  @ApiResponse({ status: 201, description: 'Herramienta creada exitosamente' })
  async create(@Body() createToolDto: CreateToolDto) {
    const tool = await this.toolService.create(createToolDto);
    return {
      message: 'Herramienta creada exitosamente',
      data: this.mapToResponseDto(tool),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todas las herramientas',
    description: 'Obtiene la lista de todas las herramientas',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Buscar herramientas por nombre, marca, modelo, serial o tipo',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    description: 'Filtrar por estado de la herramienta',
  })
  @ApiQuery({
    name: 'tipo',
    required: false,
    description: 'Filtrar por tipo de herramienta',
  })
  @ApiQuery({
    name: 'stats',
    required: false,
    description: 'Obtener estadísticas de herramientas',
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de herramientas obtenida exitosamente',
  })
  async findAll(
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('tipo') tipo?: string,
    @Query('stats') stats?: boolean,
  ) {
    let data;

    if (stats) {
      data = await this.toolService.getEquipmentStats();
      return {
        message: 'Estadísticas de herramientas obtenidas exitosamente',
        data,
      };
    }

    if (search) {
      data = await this.toolService.searchEquipment(search);
    } else if (estado) {
      data = await this.toolService.getEquipmentByStatus(estado);
    } else if (tipo) {
      data = await this.toolService.getEquipmentByType(tipo);
    } else {
      data = await this.toolService.findAll();
    }

    return {
      message: 'Herramientas obtenidas exitosamente',
      data: data.map((tool) => this.mapToResponseDto(tool)),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener herramienta por ID',
    description: 'Obtiene una herramienta específica por su ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Herramienta obtenida exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrada' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const tool = await this.toolService.findOne(id);
    return {
      message: 'Herramienta obtenida exitosamente',
      data: this.mapToResponseDto(tool),
    };
  }

  @Patch(':id')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Actualizar herramienta',
    description:
      'Actualiza una herramienta existente (Administrador y Técnico)',
  })
  @ApiResponse({
    status: 200,
    description: 'Herramienta actualizada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrada' })
  @ApiResponse({ status: 409, description: 'El número de serie ya existe' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateToolDto: UpdateToolDto,
  ) {
    const tool = await this.toolService.update(id, updateToolDto);
    return {
      message: 'Herramienta actualizada exitosamente',
      data: this.mapToResponseDto(tool),
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Eliminar herramienta',
    description:
      'Elimina una herramienta permanentemente (Solo Administrador)',
  })
  @ApiResponse({
    status: 200,
    description: 'Herramienta eliminada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrada' })
  @ApiResponse({
    status: 409,
    description:
      'No se puede eliminar la herramienta porque está en uso en órdenes de trabajo',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.toolService.remove(id);
    return {
      message: 'Herramienta eliminada exitosamente',
    };
  }

  @Patch(':id/status')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Actualizar estado de la herramienta',
    description:
      'Actualiza el estado de una herramienta (Administrador y Técnico)',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de la herramienta actualizado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrada' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: string,
  ) {
    const tool = await this.toolService.updateStatus(id, estado);
    return {
      message: 'Estado de la herramienta actualizado exitosamente',
      data: this.mapToResponseDto(tool),
    };
  }

  private mapToResponseDto(tool: Tool): ToolResponseDto {
    return {
      herramientaId: tool.herramientaId,
      nombre: tool.nombre,
      marca: tool.marca,
      serial: tool.serial,
      modelo: tool.modelo,
      caracteristicasTecnicas: tool.caracteristicasTecnicas,
      observacion: tool.observacion,
      fechaRegistro: tool.fechaRegistro,
      tipo: tool.tipo,
      estado: tool.estado,
      valorUnitario: tool.valorUnitario,
      ubicacion: tool.inventory ? tool.inventory.ubicacion : '',
      cantidadActual: tool.inventory ? tool.inventory.cantidadActual : 0,
      inventarioId: tool.inventory ? tool.inventory.inventarioId : undefined,
    };
  }
}