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
  UploadedFile,
  UseInterceptors,
  BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ToolService } from './tool.service';
import { CreateToolDto } from './dto/create-tools.dto';
import { UpdateToolDto } from './dto/update-tools.dto';
import { ToolResponseDto } from './dto/tools-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Tool } from './entities/tool.entity';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('tool')
@Controller('tool')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ToolController {
  constructor(private readonly toolService: ToolService) { }

  @Post()
  @Roles('Administrador', 'Técnico')
  @UseInterceptors(FileInterceptor('foto'))
  @ApiOperation({
    summary: 'Crear herramienta',
    description: 'Crea un nuevo herramienta (Administrador y Técnico)'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        marca: { type: 'string' },
        serial: { type: 'string' },
        modelo: { type: 'string' },
        caracteristicasTecnicas: { type: 'string' },
        observacion: { type: 'string' },
        tipo: { type: 'string' },
        estado: { type: 'string' },
        valorUnitario: { type: 'number' },
        foto: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async create(
    @Body() createToolDto: CreateToolDto,
    @UploadedFile() foto?: Express.Multer.File, // Esto funciona, pero mejor usar el tipo correcto
  ) {
    // Si hay foto, guardar la ruta
    if (foto) {
      createToolDto.fotoUrl = `/uploads/tool/${foto.filename}`;
    }

    const tool = await this.toolService.create(createToolDto);
    return {
      message: 'Herramienta creado exitosamente',
      data: this.mapToResponseDto(tool),
    };
  }


  @Get()
  @ApiOperation({
    summary: 'Obtener todos los equipos',
    description: 'Obtiene la lista de todos los equipos'
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar equipos por nombre, marca, modelo, serial o tipo'
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    description: 'Filtrar por estado del herramienta'
  })
  @ApiQuery({
    name: 'tipo',
    required: false,
    description: 'Filtrar por tipo de herramienta'
  })
  @ApiQuery({
    name: 'stats',
    required: false,
    description: 'Obtener estadísticas de equipos',
    type: Boolean
  })
  @ApiResponse({ status: 200, description: 'Lista de equipos obtenida exitosamente' })
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
        message: 'Estadísticas de equipos obtenidas exitosamente',
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
      message: 'Equipos obtenidos exitosamente',
      data: data.map(tool => this.mapToResponseDto(tool)),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener herramienta por ID',
    description: 'Obtiene un herramienta específico por su ID'
  })
  @ApiResponse({ status: 200, description: 'Herramienta obtenido exitosamente' })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const tool = await this.toolService.findOne(id);
    return {
      message: 'Herramienta obtenido exitosamente',
      data: this.mapToResponseDto(tool),
    };
  }

  @Patch(':id')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Actualizar herramienta',
    description: 'Actualiza un herramienta existente (Administrador y Técnico)'
  })
  @ApiResponse({ status: 200, description: 'Herramienta actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrado' })
  @ApiResponse({ status: 409, description: 'El número de serie ya existe' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateToolDto: UpdateToolDto,
  ) {
    const tool = await this.toolService.update(id, updateToolDto);
    return {
      message: 'Herramienta actualizado exitosamente',
      data: this.mapToResponseDto(tool),
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Eliminar herramienta',
    description: 'Elimina un herramienta permanentemente (Solo Administrador)'
  })
  @ApiResponse({ status: 200, description: 'Herramienta eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrado' })
  @ApiResponse({ status: 409, description: 'No se puede eliminar el herramienta porque está en uso' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.toolService.remove(id);
    return {
      message: 'Herramienta eliminado exitosamente',
    };
  }

  @Patch(':id/status')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Actualizar estado del herramienta',
    description: 'Actualiza el estado de un herramienta (Administrador y Técnico)'
  })
  @ApiResponse({ status: 200, description: 'Estado del herramienta actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Herramienta no encontrado' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: string,
  ) {
    const tool = await this.toolService.updateStatus(id, estado);
    return {
      message: 'Estado del herramienta actualizado exitosamente',
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
      fotoUrl: tool.fotoUrl,
      // Información del inventario
      ubicacion: tool.inventory ? tool.inventory.ubicacion : '',
      cantidadActual: tool.inventory ? tool.inventory.cantidadActual : 0,
      inventarioId: tool.inventory ? tool.inventory.inventarioId : undefined,
    };
  }

}