// src/tools/tool.controller.ts
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
  NotFoundException,
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
import { DeleteToolDto } from './dto/delete-tool.dto';
import { ToolResponseDto } from './dto/tools-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Tool } from './entities/tool.entity';
import { ToolEliminationReason } from '../shared/enums/inventory.enum';

@ApiTags('tools')
@Controller('tools')
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
  @ApiResponse({ status: 409, description: 'El número de serie ya existe' })
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
    description: 'Buscar herramientas por nombre, marca, modelo, serial o tipo',
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
  @ApiQuery({
    name: 'deleted',
    required: false,
    description: 'Incluir herramientas eliminadas',
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
    @Query('deleted') deleted?: boolean,
  ) {
    if (stats) {
      const data = await this.toolService.getEquipmentStats();
      return {
        message: 'Estadísticas de herramientas obtenidas exitosamente',
        data,
      };
    }

    let data: Tool[];
    if (deleted) {
      data = await this.toolService.getDeleted();
    } else if (search) {
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

  @Get('motivos-eliminacion')
  @ApiOperation({
    summary: 'Obtener motivos de eliminación disponibles',
    description: 'Obtiene la lista de motivos de eliminación para herramientas',
  })
  @ApiResponse({
    status: 200,
    description: 'Motivos de eliminación obtenidos exitosamente',
  })
  async getEliminationReasons() {
    return {
      message: 'Motivos de eliminación obtenidos',
      data: Object.values(ToolEliminationReason),
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

  @Get('serial/:serial')
  @ApiOperation({
    summary: 'Buscar herramienta por número de serie',
    description: 'Busca una herramienta por su número de serie único',
  })
  @ApiResponse({
    status: 200,
    description: 'Herramienta encontrada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Herramienta no encontrada con ese serial',
  })
  async findBySerial(@Param('serial') serial: string) {
    const tool = await this.toolService.findBySerial(serial);
    if (!tool) {
      throw new NotFoundException('Herramienta no encontrada con ese serial');
    }
    return {
      message: 'Herramienta encontrada exitosamente',
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
    summary: 'Eliminar herramienta permanentemente',
    description: 'Elimina una herramienta permanentemente (Solo Administrador)',
  })
  @ApiResponse({
    status: 200,
    description: 'Herramienta eliminada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrada' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.toolService.remove(id);
    return {
      message: 'Herramienta eliminada permanentemente',
    };
  }

  @Delete(':id/soft')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Eliminar herramienta con motivo (soft delete)',
    description: 'Elimina una herramienta lógicamente con motivo específico',
  })
  @ApiResponse({
    status: 200,
    description: 'Herramienta eliminada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrada' })
  @ApiResponse({
    status: 409,
    description:
      'No se puede eliminar porque está en uso en órdenes de trabajo',
  })
  async softDelete(
    @Param('id', ParseIntPipe) id: number,
    @Body() deleteToolDto: DeleteToolDto,
  ) {
    await this.toolService.softDeleteWithReason(id, deleteToolDto);
    return {
      message: `Herramienta eliminada. Motivo: ${deleteToolDto.motivo}`,
    };
  }

  @Patch(':id/restore')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Restaurar herramienta eliminada',
    description: 'Restaura una herramienta que fue eliminada lógicamente',
  })
  @ApiResponse({
    status: 200,
    description: 'Herramienta restaurada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrada' })
  async restore(@Param('id', ParseIntPipe) id: number) {
    const tool = await this.toolService.restore(id);
    return {
      message: 'Herramienta restaurada exitosamente',
      data: this.mapToResponseDto(tool),
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

  @Get('diagnose/sequence')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Diagnóstico de secuencia de herramientas',
    description: 'Verifica el estado de la secuencia de ID de herramientas',
  })
  async diagnoseSequence() {
    const result = await this.toolService.fixSequenceIfNeeded();
    return {
      message: result.message,
      corrected: result.corrected,
    };
  }

  @Get('diagnose/table')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Diagnóstico completo de tabla de herramientas',
    description: 'Verifica secuencia, constraints y datos duplicados',
  })
  async diagnoseTable() {
    const diagnosis = await this.toolService.diagnoseTable();
    return {
      message: 'Diagnóstico de tabla de herramientas completado',
      data: diagnosis,
    };
  }

  private mapToResponseDto(tool: Tool): ToolResponseDto {
    const response: ToolResponseDto = {
      herramientaId: tool.herramientaId,
      nombre: tool.nombre,
      marca: tool.marca ?? '',
      serial: tool.serial ?? '',
      modelo: tool.modelo ?? '',
      caracteristicasTecnicas: tool.caracteristicasTecnicas ?? '',
      observacion: tool.observacion ?? '',
      fechaRegistro: tool.fechaRegistro,
      tipo: tool.tipo,
      estado: tool.estado,
      valorUnitario: tool.valorUnitario,
      cantidadActual: tool.inventory?.cantidadActual ?? 0,
      inventarioId: tool.inventory?.inventarioId,
    };

    if (tool.inventory?.bodega) {
      response.bodega = {
        bodegaId: tool.inventory.bodega.bodegaId,
        nombre: tool.inventory.bodega.nombre,
      };
    }

    if (tool.fechaEliminacion) {
      response.fechaEliminacion = tool.fechaEliminacion;
    }

    if (tool.motivoEliminacion) {
      response.motivoEliminacion = tool.motivoEliminacion;
    }

    if (tool.observacionEliminacion) {
      response.observacionEliminacion = tool.observacionEliminacion;
    }

    if (tool.images && tool.images.length > 0) {
      response.imagenes = tool.images.map((img) => img.url);
    }

    return response;
  }
}
