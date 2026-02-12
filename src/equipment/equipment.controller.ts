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
  Req,
  Res,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
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
import { EquipmentDocumentsService } from './equipment-documents.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@ApiTags('equipment')
@Controller('equipment')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EquipmentController {
  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly equipmentDocumentsService: EquipmentDocumentsService,
  ) {}

  @Post()
  @Roles('Administrador', 'Técnico')
  @ApiOperation({ summary: 'Crear equipo (hoja de vida)' })
  @ApiResponse({
    status: 201,
    description: 'Equipo creado',
    type: EquipmentResponseDto,
  })
  async create(
    @Body() createEquipmentDto: CreateEquipmentDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;

    const createBy = `${user?.nombre} ${user?.apellido ?? user?.email ?? (user?.id != null ? String(user.id) : undefined)}`;

    const equipment = await this.equipmentService.create(
      createEquipmentDto,
      createBy,
    );

    return {
      message: 'Equipo creado exitosamente',
      data: this.mapToResponseDto(equipment),
    };
  }

  @Get()
  @Roles('Administrador', 'Secretaria', 'Técnico')
  @ApiOperation({ summary: 'Obtener todos los equipos' })
  @ApiQuery({ name: 'clientId', required: false, type: Number })
  @ApiQuery({ name: 'areaId', required: false, type: Number })
  @ApiQuery({ name: 'subAreaId', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Equipos obtenidos',
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
  @ApiOperation({ summary: 'Obtener equipo por ID' })
  @ApiResponse({
    status: 200,
    description: 'Equipo obtenido',
    type: EquipmentResponseDto,
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const equipment = await this.equipmentService.findOne(id);
    return {
      message: 'Equipo obtenido exitosamente',
      data: this.mapToResponseDto(equipment),
    };
  }

  @Get(':id/work-orders')
  @Roles('Administrador', 'Secretaria', 'Técnico', 'Cliente')
  @ApiOperation({ summary: 'Obtener historial de órdenes del equipo' })
  async getEquipmentWorkOrders(@Param('id', ParseIntPipe) id: number) {
    const workOrders = await this.equipmentService.getEquipmentWorkOrders(id);
    return {
      message: 'Órdenes del equipo obtenidas exitosamente',
      data: workOrders,
    };
  }

  @Patch(':id')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({ summary: 'Actualizar equipo' })
  @ApiResponse({
    status: 200,
    description: 'Equipo actualizado',
    type: EquipmentResponseDto,
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEquipmentDto: UpdateEquipmentDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;

    const updatedBy = `${user?.nombre} ${user?.apellido ?? user?.email ?? (user?.id != null ? String(user.id) : undefined)}`;

    const equipment = await this.equipmentService.update(
      id,
      updateEquipmentDto,
      updatedBy,
    );
    return {
      message: 'Equipo actualizado exitosamente',
      data: this.mapToResponseDto(equipment),
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({ summary: 'Eliminar equipo' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.equipmentService.remove(id);
    return { message: 'Equipo eliminado exitosamente' };
  }

  @Get('maintenance-plan/export')
  @Roles('Administrador', 'Secretaria', 'Técnico')
  @ApiOperation({
    summary: 'Exportar plan de mantenimiento anual por cliente',
    description:
      'Genera un archivo Excel con el plan de mantenimiento anual de los aires de un cliente',
  })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'clientId', required: true, type: Number })
  async exportAnnualMaintenancePlanForClient(
    @Res() res: Response,
    @Query('year') year?: string,
    @Query('clientId') clientId?: string,
  ) {
    if (!clientId) {
      throw new BadRequestException('clientId es obligatorio');
    }

    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const client = parseInt(clientId, 10);

    const buffer =
      await this.equipmentService.generateAnnualMaintenanceExcelForClient(
        y,
        client,
      );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="plan_mantenimiento_cliente_${client}_${y}.xlsx"`,
    );

    res.send(buffer);
  }

  @Patch(':id/maintenance-plan/advance')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Avanzar plan de mantenimiento del equipo',
  })
  async advanceMaintenancePlan(@Param('id', ParseIntPipe) id: number) {
    const equipment =
      await this.equipmentService.advanceMaintenancePlanForEquipment(id);

    return {
      message: 'Plan de mantenimiento actualizado correctamente',
      data: this.mapToResponseDto(equipment),
    };
  }

  @Get(':id/documents')
  @Roles('Administrador', 'Secretaria', 'Técnico', 'Cliente')
  async listDocuments(@Param('id', ParseIntPipe) id: number) {
    const docs = await this.equipmentDocumentsService.listByEquipment(id);
    return { message: 'Documentos obtenidos', data: docs };
  }

  @Post(':id/documents')
  @Roles('Administrador', 'Técnico')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
      fileFilter: (req, file, cb) => {
        const isPdf =
          file.mimetype === 'application/pdf' ||
          file.originalname.toLowerCase().endsWith('.pdf');

        if (!isPdf) {
          return cb(
            new BadRequestException('Solo se permiten PDFs') as any,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadDocument(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const saved = await this.equipmentDocumentsService.upload(id, file);
    return { message: 'Documento subido', data: saved };
  }

  // ===== tu mapToResponseDto igual (no lo toqué) =====
  private mapToResponseDto(equipment: Equipment): EquipmentResponseDto {
    const workOrders =
      equipment.equipmentWorkOrders?.map((ewo) => ({
        workOrderId: ewo.workOrder?.ordenId,
        description: ewo.description,
        createdAt: ewo.createdAt,
      })) || [];

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
      workOrders,
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
      code: equipment.code,
      status: equipment.status,
      installationDate: equipment.installationDate,
      notes: equipment.notes,
      createdBy: equipment.createdBy,
      updatedBy: equipment.updatedBy,
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
      evaporators: equipment.evaporators?.map((evap) => ({
        marca: evap.marca,
        modelo: evap.modelo,
        serial: evap.serial,
        capacidad: evap.capacidad,
        tipoRefrigerante: evap.tipoRefrigerante,
        motors: evap.motors?.map((m) => ({
          amperaje: m.amperaje,
          voltaje: m.voltaje,
          numeroFases: m.numeroFases,
          diametroEje: m.diametroEje,
          tipoEje: m.tipoEje,
          rpm: m.rpm,
          correa: m.correa,
          diametroPolea: m.diametroPolea,
          capacidadHp: m.capacidadHp,
          frecuencia: m.frecuencia,
        })),
      })),
      condensers: equipment.condensers?.map((cond) => ({
        marca: cond.marca,
        modelo: cond.modelo,
        serial: cond.serial,
        capacidad: cond.capacidad,
        amperaje: cond.amperaje,
        voltaje: cond.voltaje,
        tipoRefrigerante: cond.tipoRefrigerante,
        numeroFases: cond.numeroFases,
        presionAlta: cond.presionAlta,
        presionBaja: cond.presionBaja,
        hp: cond.hp,
        motors: cond.motors?.map((m) => ({
          amperaje: m.amperaje,
          voltaje: m.voltaje,
          numeroFases: m.numeroFases,
          diametroEje: m.diametroEje,
          tipoEje: m.tipoEje,
          rpm: m.rpm,
          correa: m.correa,
          diametroPolea: m.diametroPolea,
          capacidadHp: m.capacidadHp,
          frecuencia: m.frecuencia,
        })),
        compressors: cond.compressors?.map((c) => ({
          marca: c.marca,
          modelo: c.modelo,
          serial: c.serial,
          capacidad: c.capacidad,
          voltaje: c.voltaje,
          frecuencia: c.frecuencia,
          tipoRefrigerante: c.tipoRefrigerante,
          tipoAceite: c.tipoAceite,
          cantidadAceite: c.cantidadAceite,
          capacitor: c.capacitor,
          lra: c.lra,
          fla: c.fla,
          cantidadPolos: c.cantidadPolos,
          amperaje: c.amperaje,
          voltajeBobina: c.voltajeBobina,
          vac: c.vac,
        })),
      })),
      planMantenimiento: equipment.planMantenimiento
        ? {
            unidadFrecuencia: equipment.planMantenimiento.unidadFrecuencia,
            diaDelMes: equipment.planMantenimiento.diaDelMes,
            fechaProgramada: equipment.planMantenimiento.fechaProgramada,
            notas: equipment.planMantenimiento.notas,
          }
        : null,
    };
  }
}
