// src/equipment/equipment.controller.ts
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
      'Crea un nuevo equipo asociado a un cliente (empresa) y a un área/subárea',
  })
  @ApiResponse({
    status: 201,
    description: 'Equipo creado exitosamente',
    type: EquipmentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({
    status: 404,
    description: 'Cliente, área o subárea no encontrada',
  })
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
    type: Number,
  })
  @ApiQuery({
    name: 'areaId',
    required: false,
    description: 'Filtrar por ID de área',
    type: Number,
  })
  @ApiQuery({
    name: 'subAreaId',
    required: false,
    description: 'Filtrar por ID de subárea',
    type: Number,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar por nombre, código, serie o marca del equipo',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Equipos obtenidos exitosamente',
    type: [EquipmentResponseDto],
  })
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
  @ApiResponse({
    status: 200,
    description: 'Equipo obtenido exitosamente',
    type: EquipmentResponseDto,
  })
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
  @ApiResponse({
    status: 200,
    description: 'Equipo actualizado exitosamente',
    type: EquipmentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEquipmentDto: UpdateEquipmentDto,
  ) {

    const equipment = await this.equipmentService.update(
      id,
      updateEquipmentDto,
    );
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
      'Elimina un equipo permanentemente (y las imágenes asociadas en Cloudinary)',
  })
  @ApiResponse({ status: 200, description: 'Equipo eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.equipmentService.remove(id);
    return {
      message: 'Equipo eliminado exitosamente',
    };
  }

  // ... imports y código anterior ...

  private mapToResponseDto(equipment: Equipment): EquipmentResponseDto {
    const motor = equipment.motors?.[0] ?? null;
    const evaporator = equipment.evaporators?.[0] ?? null;
    const condenser = equipment.condensers?.[0] ?? null;
    const compressor = equipment.compressors?.[0] ?? null;

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
      workOrderId: equipment.workOrderId ?? null,
      category: equipment.category,
      airConditionerTypeId: equipment.airConditionerTypeId,
      airConditionerType: equipment.airConditionerType
        ? {
            id: equipment.airConditionerType.id,
            name: equipment.airConditionerType.name,
            hasEvaporator: equipment.airConditionerType.hasEvaporator,
            hasCondenser: equipment.airConditionerType.hasCondenser,
          }
        : undefined,
      name: equipment.name,
      code: equipment.code,
      physicalLocation: equipment.physicalLocation,
      status: equipment.status,
      installationDate: equipment.installationDate,
      notes: equipment.notes,
      createdAt: equipment.createdAt,
      updatedAt: equipment.updatedAt,
      photos:
        equipment.images?.map((img) => ({
          photoId: img.id,
          equipmentId: equipment.equipmentId,
          url: img.url,
          description: null,
          createdAt: img.created_at.toISOString(),
        })) ?? [],
      motor: motor
        ? {
            amperaje: motor.amperaje,
            voltaje: motor.voltaje,
            rpm: motor.rpm,
            serialMotor: motor.serialMotor,
            modeloMotor: motor.modeloMotor,
            diametroEje: motor.diametroEje,
            tipoEje: motor.tipoEje,
          }
        : null,
      evaporator: evaporator
        ? {
            marca: evaporator.marca,
            modelo: evaporator.modelo,
            serial: evaporator.serial,
            capacidad: evaporator.capacidad,
            amperaje: evaporator.amperaje,
            tipoRefrigerante: evaporator.tipoRefrigerante,
            voltaje: evaporator.voltaje,
            numeroFases: evaporator.numeroFases,
          }
        : null,
      condenser: condenser
        ? {
            marca: condenser.marca,
            modelo: condenser.modelo,
            serial: condenser.serial,
            capacidad: condenser.capacidad,
            amperaje: condenser.amperaje,
            voltaje: condenser.voltaje,
            tipoRefrigerante: condenser.tipoRefrigerante,
            numeroFases: condenser.numeroFases,
            presionAlta: condenser.presionAlta,
            presionBaja: condenser.presionBaja,
            hp: condenser.hp,
          }
        : null,
      compressor: compressor
        ? {
            marca: compressor.marca,
            modelo: compressor.modelo,
            serial: compressor.serial,
            capacidad: compressor.capacidad,
            amperaje: compressor.amperaje,
            tipoRefrigerante: compressor.tipoRefrigerante,
            voltaje: compressor.voltaje,
            numeroFases: compressor.numeroFases,
            tipoAceite: compressor.tipoAceite,
            cantidadAceite: compressor.cantidadAceite,
          }
        : null,
    };
  }
}
