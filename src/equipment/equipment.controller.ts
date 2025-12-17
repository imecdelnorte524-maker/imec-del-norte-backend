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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentResponseDto } from './dto/equipment-response.dto';
import { AddEquipmentPhotoDto } from './dto/add-equipment-photo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Equipment } from './entities/equipment.entity';

@ApiTags('equipment')
@Controller('equipment')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Post()
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Crear equipo (hoja de vida)',
    description:
      'Crea un nuevo equipo asociado a un cliente (empresa) y opcionalmente a un área/subárea',
  })
  @ApiResponse({ status: 201, description: 'Equipo creado exitosamente' })
  async create(@Body() createEquipmentDto: CreateEquipmentDto) {
    const equipment = await this.equipmentService.create(createEquipmentDto);
    return {
      message: 'Equipo creado exitosamente',
      data: this.mapToResponseDto(equipment),
    };
  }

  @Get()
  @Roles('Administrador', 'Secretaria', 'Técnico')
  @ApiOperation({
    summary: 'Obtener todos los equipos',
    description:
      'Obtiene la lista de equipos, con opción de filtrar por cliente, área, subárea o búsqueda',
  })
  @ApiQuery({
    name: 'clientId',
    required: false,
    description: 'Filtrar por ID de cliente (empresa)',
  })
  @ApiQuery({
    name: 'areaId',
    required: false,
    description: 'Filtrar por ID de área',
  })
  @ApiQuery({
    name: 'subAreaId',
    required: false,
    description: 'Filtrar por ID de subárea',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar por nombre o código de equipo',
  })
  @ApiResponse({ status: 200, description: 'Equipos obtenidos exitosamente' })
  async findAll(
    @Query('clientId') clientId?: string,
    @Query('areaId') areaId?: string,
    @Query('subAreaId') subAreaId?: string,
    @Query('search') search?: string,
  ) {
    const equipments = await this.equipmentService.findAll({
      clientId: clientId ? parseInt(clientId, 10) : undefined,
      areaId: areaId ? parseInt(areaId, 10) : undefined,
      subAreaId: subAreaId ? parseInt(subAreaId, 10) : undefined,
      search,
    });

    return {
      message: 'Equipos obtenidos exitosamente',
      data: equipments.map((eq) => this.mapToResponseDto(eq)),
    };
  }

  @Get(':id')
  @Roles('Administrador', 'Secretaria', 'Técnico')
  @ApiOperation({
    summary: 'Obtener equipo por ID',
    description: 'Obtiene la información detallada de un equipo por su ID',
  })
  @ApiResponse({ status: 200, description: 'Equipo obtenido exitosamente' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const equipment = await this.equipmentService.findOne(id);
    return {
      message: 'Equipo obtenido exitosamente',
      data: this.mapToResponseDto(equipment),
    };
  }

  @Patch(':id')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Actualizar equipo',
    description: 'Actualiza la información de un equipo existente',
  })
  @ApiResponse({ status: 200, description: 'Equipo actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEquipmentDto: UpdateEquipmentDto,
  ) {
    const equipment = await this.equipmentService.update(id, updateEquipmentDto);
    return {
      message: 'Equipo actualizado exitosamente',
      data: this.mapToResponseDto(equipment),
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Eliminar equipo',
    description:
      'Elimina un equipo permanentemente (incluye sus fotos asociadas)',
  })
  @ApiResponse({ status: 200, description: 'Equipo eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.equipmentService.remove(id);
    return {
      message: 'Equipo eliminado exitosamente',
    };
  }

  @Post(':id/photos')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Agregar foto a equipo',
    description: 'Agrega una foto (por URL) a la hoja de vida del equipo',
  })
  @ApiResponse({ status: 201, description: 'Foto agregada exitosamente' })
  async addPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Body() addEquipmentPhotoDto: AddEquipmentPhotoDto,
  ) {
    const photo = await this.equipmentService.addPhoto(id, addEquipmentPhotoDto);
    return {
      message: 'Foto agregada exitosamente al equipo',
      data: photo,
    };
  }

  @Delete(':id/photos/:photoId')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Eliminar foto de equipo',
    description: 'Elimina una foto de la hoja de vida del equipo',
  })
  @ApiResponse({ status: 200, description: 'Foto eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Foto no encontrada' })
  async removePhoto(
    @Param('id', ParseIntPipe) id: number,
    @Param('photoId', ParseIntPipe) photoId: number,
  ) {
    await this.equipmentService.removePhoto(id, photoId);
    return {
      message: 'Foto eliminada exitosamente del equipo',
    };
  }

  private mapToResponseDto(equipment: Equipment): EquipmentResponseDto {
    return {
      equipmentId: equipment.equipmentId,
      client: {
        idCliente: equipment.client.idCliente,
        nombre: equipment.client.nombre,
        nit: equipment.client.nit,
      },
      area: equipment.area
        ? {
            idArea: equipment.area.idArea,
            nombreArea: equipment.area.nombreArea,
          }
        : undefined,
      subArea: equipment.subArea
        ? {
            idSubArea: equipment.subArea.idSubArea,
            nombreSubArea: equipment.subArea.nombreSubArea,
          }
        : undefined,
      category: equipment.category,
      name: equipment.name,
      code: equipment.code,
      brand: equipment.brand,
      model: equipment.model,
      serialNumber: equipment.serialNumber,
      capacity: equipment.capacity,
      refrigerantType: equipment.refrigerantType,
      voltage: equipment.voltage,
      physicalLocation: equipment.physicalLocation,
      manufacturer: equipment.manufacturer,
      status: equipment.status,
      installationDate: equipment.installationDate,
      notes: equipment.notes,
      createdAt: equipment.createdAt,
      updatedAt: equipment.updatedAt,
      photos: Array.isArray(equipment.photos)
        ? equipment.photos.map((p) => ({
            photoId: p.photoId,
            equipmentId: p.equipmentId,
            url: p.url,
            description: p.description ?? null,
            createdAt: p.createdAt,
          }))
        : [],
    };
  }
}