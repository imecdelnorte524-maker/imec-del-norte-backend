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
  ForbiddenException,
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
import { Public } from '../common/decorators/public.decorator';

@ApiTags('equipment')
@Controller('equipment')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EquipmentController {
  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly equipmentDocumentsService: EquipmentDocumentsService,
  ) {}

  private getRoleName(user: any): string {
    return user?.role?.nombreRol || user?.role || '';
  }

  @Get('client')
  @UseGuards(JwtAuthGuard)
  async getClientEquipment(@Req() req: any) {
    const userId = req.user.userId;

    if (!userId) {
      return {
        message: 'Usuario no autenticado',
        data: [],
      };
    }

    const equipment = await this.equipmentService.findByClientUser(userId);
    return {
      message: 'Equipos del cliente obtenidos exitosamente',
      data: equipment,
    };
  }

  @Post()
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
    @Req() req?: Request, // 👈 NUEVO
  ) {
    const user: any = (req as any)?.user;
    const roleName = this.getRoleName(user);

    let equipments: Equipment[];

    if (roleName === 'Cliente') {
      // 1) Obtener las empresas (Client.idCliente) asignadas a este usuario
      const empresaIds = await this.equipmentService.getClientEmpresaIdsForUser(
        user.userId,
      );

      if (!empresaIds.length) {
        return {
          message: 'No hay empresas asociadas al usuario cliente',
          data: [],
        };
      }

      // 2) Ignoramos clientId de la query para evitar que un cliente vea otra empresa
      equipments = await this.equipmentService.findAll({
        clientIds: empresaIds,
        areaId: areaId ? parseInt(areaId, 10) : undefined,
        subAreaId: subAreaId ? parseInt(subAreaId, 10) : undefined,
        search,
      });
    } else {
      // Comportamiento anterior para Admin, Técnico, etc.
      equipments = await this.equipmentService.findAll({
        clientId: clientId ? parseInt(clientId, 10) : undefined,
        areaId: areaId ? parseInt(areaId, 10) : undefined,
        subAreaId: subAreaId ? parseInt(subAreaId, 10) : undefined,
        search,
      });
    }

    return {
      message: 'Equipos obtenidos exitosamente',
      data: equipments.map((eq) => this.mapToResponseDto(eq)),
    };
  }

  @Get(':id')
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
  @ApiOperation({ summary: 'Obtener historial de órdenes del equipo' })
  async getEquipmentWorkOrders(@Param('id', ParseIntPipe) id: number) {
    const workOrders = await this.equipmentService.getEquipmentWorkOrders(id);
    return {
      message: 'Órdenes del equipo obtenidas exitosamente',
      data: workOrders,
    };
  }

  @Patch(':id')
   
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
   
  @ApiOperation({ summary: 'Eliminar equipo' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.equipmentService.remove(id);
    return { message: 'Equipo eliminado exitosamente' };
  }

  @Get('maintenance-plan/export')
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
  async listDocuments(@Param('id', ParseIntPipe) id: number) {
    const docs = await this.equipmentDocumentsService.listByEquipment(id);
    return { message: 'Documentos obtenidos', data: docs };
  }

  @Post(':id/documents')
   
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

  @Get('export/inventory-equipment')
  async exportInventory(
    @Res() res: Response,
    @Query('clientId') clientId?: number,
  ) {
    const buffer = await this.equipmentService.generateEquipmentInventoryExcel(
      clientId ? Number(clientId) : undefined,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="INVENTARIO-EQUIPOS.xlsx"`,
    );
    res.send(buffer);
  }

  @Get(':id/history-pdf')
  @Public()
  @ApiOperation({
    summary: 'Generar PDF con historial completo del equipo',
    description:
      'Genera un PDF con información del equipo, componentes, plan de mantenimiento y todas las órdenes de trabajo asociadas',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente',
    content: {
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
    },
  })
  async generateHistoryPdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Req() req: any,
  ) {
    // Verificar permisos (similar a otros endpoints)
    const roleName = this.getRoleName(req.user);

    if (roleName === 'Cliente') {
      const empresaIds = await this.equipmentService.getClientEmpresaIdsForUser(
        req.user.userId,
      );
      const equipment = await this.equipmentService.findOne(id);

      if (!empresaIds.includes(equipment.clientId)) {
        throw new ForbiddenException('No tiene acceso a este equipo');
      }
    }

    const pdfBuffer =
      await this.equipmentService.generateEquipmentHistoryPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="historial-equipo-${id}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
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
        airConditionerTypeEvapId: evap.airConditionerTypeEvapId,
        airConditionerTypeEvap: evap.airConditionerTypeEvap
          ? {
              id: evap.airConditionerTypeEvap.id,
              name: evap.airConditionerTypeEvap.name,
              hasEvaporator: evap.airConditionerTypeEvap.hasEvaporator,
              hasCondenser: evap.airConditionerTypeEvap.hasCondenser,
            }
          : undefined,
        marca: evap.marca,
        modelo: evap.modelo,
        serial: evap.serial,
        capacidad: evap.capacidad,
        tipoRefrigerante: evap.tipoRefrigerante,
        motors: evap.motors?.map((m) => ({
          amperaje: m.amperaje,
          voltaje: m.voltaje,
          numeroFases: m.numeroFases,
          numeroparte: m.numeroParte,
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
          numeroParte: m.numeroParte,
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
      planMantenimientoAutomatico: equipment.planMantenimientoAutomatico,
    };
  }
}
