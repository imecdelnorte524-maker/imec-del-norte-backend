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
} from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceResponseDto } from './dto/service-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Service } from './entities/service.entity';

@ApiTags('services')
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @Roles('Administrador', 'Secretaria')
  @ApiOperation({
    summary: 'Crear servicio',
    description: 'Crea un nuevo servicio (Administrador y Secretaria)',
  })
  @ApiResponse({ status: 201, description: 'Servicio creado exitosamente' })
  @ApiResponse({ status: 409, description: 'El nombre del servicio ya existe' })
  async create(@Body() createServiceDto: CreateServiceDto) {
    const service = await this.servicesService.create(createServiceDto);
    return {
      message: 'Servicio creado exitosamente',
      data: this.mapToResponseDto(service),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todos los servicios',
    description: 'Obtiene la lista de todos los servicios',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar servicios por nombre o descripción',
  })
  @ApiQuery({
    name: 'stats',
    required: false,
    description: 'Incluir estadísticas de órdenes de trabajo',
    type: Boolean,
  })
  @ApiResponse({ status: 200, description: 'Lista de servicios obtenida exitosamente' })
  async findAll(
    @Query('search') search?: string,
    @Query('stats') stats?: boolean,
  ) {
    let data;

    if (search) {
      data = await this.servicesService.searchServices(search);
    } else if (stats) {
      data = await this.servicesService.getServicesWithStats();
    } else {
      data = await this.servicesService.findAll();
    }

    return {
      message: 'Servicios obtenidos exitosamente',
      data: stats ? data : data.map((service) => this.mapToResponseDto(service)),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener servicio por ID',
    description: 'Obtiene un servicio específico por su ID',
  })
  @ApiResponse({ status: 200, description: 'Servicio obtenido exitosamente' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const service = await this.servicesService.findOne(id);
    return {
      message: 'Servicio obtenido exitosamente',
      data: this.mapToResponseDto(service),
    };
  }

  @Patch(':id')
  @Roles('Administrador', 'Secretaria')
  @ApiOperation({
    summary: 'Actualizar servicio',
    description: 'Actualiza un servicio existente (Administrador y Secretaria)',
  })
  @ApiResponse({ status: 200, description: 'Servicio actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({ status: 409, description: 'El nombre del servicio ya existe' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    const service = await this.servicesService.update(id, updateServiceDto);
    return {
      message: 'Servicio actualizado exitosamente',
      data: this.mapToResponseDto(service),
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Eliminar servicio',
    description: 'Elimina un servicio permanentemente (Solo Administrador)',
  })
  @ApiResponse({ status: 200, description: 'Servicio eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({
    status: 409,
    description:
      'No se puede eliminar el servicio porque está siendo usado en órdenes de trabajo',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.servicesService.remove(id);
    return {
      message: 'Servicio eliminado exitosamente',
    };
  }

  @Get('search/:keyword')
  @ApiOperation({
    summary: 'Buscar servicios',
    description: 'Busca servicios por nombre o descripción',
  })
  @ApiResponse({ status: 200, description: 'Búsqueda completada exitosamente' })
  async search(@Param('keyword') keyword: string) {
    const services = await this.servicesService.searchServices(keyword);
    return {
      message: 'Búsqueda completada exitosamente',
      data: services.map((service) => this.mapToResponseDto(service)),
    };
  }

  private mapToResponseDto(service: Service): ServiceResponseDto {
    return {
      servicioId: service.servicioId,
      nombreServicio: service.nombreServicio,
      descripcion: service.descripcion,
      precioBase: service.precioBase,
      duracionEstimada: service.duracionEstimada,
      categoriaServicio: service.categoriaServicio,
      tipoTrabajo: service.tipoTrabajo,
      tipoMantenimiento: service.tipoMantenimiento,
    };
  }
}