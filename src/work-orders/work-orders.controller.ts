// src/work-orders/work-orders.controller.ts
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
  Req,
  ForbiddenException,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WorkOrdersService } from './work-orders.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { AddSupplyDetailDto } from './dto/add-supply-detail.dto';
import { AddToolDetailDto } from './dto/add-tool-detail.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { AssignTechniciansDto } from './dto/assign-technicians.dto';
import { CreateEmergencyOrderDto } from './dto/create-emergency-order.dto';
import {
  AreaInfo,
  SubAreaInfo,
  WorkOrderResponseDto,
} from './dto/work-order-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WorkOrder } from './entities/work-order.entity';
import { diskStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import { ServiceCategory } from 'src/services/enums/service.enums';

@ApiTags('work-orders')
@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  private getRoleName(user: any): string {
    return user?.role?.nombreRol || user?.role || '';
  }

  @Post()
  @Roles('Administrador', 'Cliente')
  @ApiOperation({ summary: 'Crear una nueva orden de trabajo' })
  async create(@Body() dto: CreateWorkOrderDto, @Req() req: any) {
    const workOrder = await this.workOrdersService.create(dto, req.user);
    const costs = await this.workOrdersService.calculateTotalCost(
      workOrder.ordenId,
    );

    return {
      message: 'Orden de trabajo creada exitosamente',
      data: {
        ...this.mapToResponseDto(workOrder),
        ...costs,
      },
    };
  }

  @Post(':id/emergency')
  @ApiOperation({
    summary: 'Crear una orden de emergencia desde una orden existente',
  })
  async createEmergency(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateEmergencyOrderDto,
    @Req() req: any,
  ) {
    const workOrder = await this.workOrdersService.createEmergencyOrder(
      id,
      dto,
      req.user,
    );
    const costs = await this.workOrdersService.calculateTotalCost(
      workOrder.ordenId,
    );

    return {
      message: 'Orden de emergencia creada exitosamente',
      data: {
        ...this.mapToResponseDto(workOrder),
        ...costs,
      },
    };
  }

  @Get()
  @Roles('Administrador', 'Técnico', 'Secretaria', 'Cliente', 'Supervisor')
  @ApiOperation({
    summary:
      'Obtener órdenes de trabajo (filtradas por rol: técnico/cliente solo ven las suyas)',
  })
  async findAll(@Req() req: any) {
    const roleName = this.getRoleName(req.user);
    let data: WorkOrder[];

    if (roleName === 'Técnico') {
      data = await this.workOrdersService.getWorkOrdersByTechnician(
        req.user.userId,
      );
    } else if (roleName === 'Cliente') {
      data = await this.workOrdersService.getWorkOrdersByClient(
        req.user.userId,
      );
    } else {
      data = await this.workOrdersService.findAll();
    }

    const ordersWithCosts = await Promise.all(
      data.map(async (order) => {
        const costs = await this.workOrdersService.calculateTotalCost(
          order.ordenId,
        );
        return {
          ...this.mapToResponseDto(order),
          ...costs,
        };
      }),
    );

    return {
      message: 'Órdenes de trabajo obtenidas exitosamente',
      data: ordersWithCosts,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una orden de trabajo por ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const workOrder = await this.workOrdersService.findOne(id);
    const roleName = this.getRoleName(req.user);

    if (roleName === 'Técnico') {
      const isAssigned = workOrder.technicians?.some(
        (t) => t.tecnicoId === req.user.userId,
      );
      if (!isAssigned) {
        throw new ForbiddenException();
      }
    }

    if (roleName === 'Cliente' && workOrder.clienteId !== req.user.userId) {
      throw new ForbiddenException();
    }

    const costs = await this.workOrdersService.calculateTotalCost(id);

    return {
      message: 'Orden de trabajo obtenida exitosamente',
      data: {
        ...this.mapToResponseDto(workOrder),
        ...costs,
      },
    };
  }

  @Patch(':id')
  @Roles('Administrador', 'Técnico', 'Secretaria', 'Supervisor')
  @ApiOperation({ summary: 'Actualizar una orden de trabajo' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkOrderDto,
    @Req() req: any,
  ) {
    const workOrder = await this.workOrdersService.update(id, dto, req.user);
    const costs = await this.workOrdersService.calculateTotalCost(id);

    return {
      message: 'Orden de trabajo actualizada exitosamente',
      data: {
        ...this.mapToResponseDto(workOrder),
        ...costs,
      },
    };
  }

  @Patch(':id/cancel')
  @Roles('Cliente')
  @ApiOperation({ summary: 'Cancelar una orden por parte del cliente' })
  async cancelByClient(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const workOrder = await this.workOrdersService.cancelByClient(id, req.user);
    const costs = await this.workOrdersService.calculateTotalCost(id);

    return {
      message: 'Orden de trabajo cancelada exitosamente',
      data: {
        ...this.mapToResponseDto(workOrder),
        ...costs,
      },
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({ summary: 'Eliminar una orden de trabajo' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.workOrdersService.remove(id);
    return {
      message: 'Orden de trabajo eliminada exitosamente',
    };
  }

  @Patch(':id/assign-technician')
  @Roles('Administrador', 'Secretaria', 'Supervisor')
  @ApiOperation({
    summary:
      'Asignar o cambiar el técnico de una orden (legacy - un solo técnico)',
  })
  async assignTechnician(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignTechnicianDto,
  ) {
    // Para compatibilidad con versión anterior
    const techniciansDto: AssignTechniciansDto = {
      technicianIds: [dto.tecnicoId],
      leaderTechnicianId: dto.tecnicoId,
    };

    const workOrder = await this.workOrdersService.assignTechnicians(
      id,
      techniciansDto,
    );
    const costs = await this.workOrdersService.calculateTotalCost(id);

    return {
      message: 'Técnico asignado/reasignado correctamente',
      data: {
        ...this.mapToResponseDto(workOrder),
        ...costs,
      },
    };
  }

  @Patch(':id/assign-technicians')
  @Roles('Administrador', 'Secretaria', 'Supervisor')
  @ApiOperation({ summary: 'Asignar múltiples técnicos a una orden' })
  async assignTechnicians(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignTechniciansDto,
  ) {
    const workOrder = await this.workOrdersService.assignTechnicians(id, dto);
    const costs = await this.workOrdersService.calculateTotalCost(id);

    return {
      message: 'Técnicos asignados correctamente',
      data: {
        ...this.mapToResponseDto(workOrder),
        ...costs,
      },
    };
  }

  @Delete(':id/technicians')
  @Roles('Administrador', 'Secretaria', 'Supervisor')
  @ApiOperation({
    summary: 'Quitar todos los técnicos de una orden de trabajo',
  })
  async unassignAllTechnicians(@Param('id', ParseIntPipe) id: number) {
    const workOrder = await this.workOrdersService.unassignAllTechnicians(id);
    const costs = await this.workOrdersService.calculateTotalCost(id);

    return {
      message: 'Técnicos removidos de la orden correctamente',
      data: {
        ...this.mapToResponseDto(workOrder),
        ...costs,
      },
    };
  }

  @Post(':id/start-timer')
  @Roles('Técnico', 'Administrador', 'Secretaria', 'Supervisor')
  @ApiOperation({ summary: 'Iniciar cronómetro para orden en proceso' })
  async startTimer(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const timer = await this.workOrdersService.startTimer(id, req.user.userId);
    return {
      message: 'Cronómetro iniciado correctamente',
      data: timer,
    };
  }

  @Post(':id/stop-timer')
  @Roles('Técnico', 'Administrador', 'Secretaria', 'Supervisor')
  @ApiOperation({ summary: 'Detener cronómetro' })
  async stopTimer(@Param('id', ParseIntPipe) id: number) {
    const timer = await this.workOrdersService.stopTimer(id);
    return {
      message: 'Cronómetro detenido correctamente',
      data: timer,
    };
  }

  @Post(':id/pause')
  @Roles('Técnico', 'Administrador', 'Secretaria', 'Supervisor')
  @ApiOperation({ summary: 'Pausar orden en proceso' })
  async pauseOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { observacion?: string },
    @Req() req: any,
  ) {
    const pause = await this.workOrdersService.pauseOrder(
      id,
      req.user.userId,
      body.observacion,
    );
    return {
      message: 'Orden pausada correctamente',
      data: pause,
    };
  }

  @Post(':id/resume')
  @Roles('Técnico', 'Administrador', 'Secretaria', 'Supervisor')
  @ApiOperation({ summary: 'Reanudar orden en pausa' })
  async resumeOrder(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const timer = await this.workOrdersService.resumeOrder(id, req.user.userId);
    return {
      message: 'Orden reanudada correctamente',
      data: timer,
    };
  }

  @Post(':id/equipment/:equipmentId')
  @Roles('Administrador', 'Técnico', 'Secretaria', 'Supervisor')
  @ApiOperation({ summary: 'Asociar un equipo a una orden' })
  async addEquipment(
    @Param('id', ParseIntPipe) ordenId: number,
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
    @Body() body: { description?: string },
  ) {
    const result = await this.workOrdersService.addEquipmentToOrder(
      ordenId,
      equipmentId,
      body.description,
    );
    return {
      message: 'Equipo asociado a la orden correctamente',
      data: result,
    };
  }

  @Delete(':id/equipment/:equipmentId')
  @Roles('Administrador', 'Técnico', 'Secretaria', 'Supervisor')
  @ApiOperation({ summary: 'Desasociar un equipo de una orden' })
  async removeEquipment(
    @Param('id', ParseIntPipe) ordenId: number,
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
  ) {
    await this.workOrdersService.removeEquipmentFromOrder(ordenId, equipmentId);
    return {
      message: 'Equipo desasociado de la orden correctamente',
    };
  }

  @Get('equipment/:equipmentId')
  @Roles('Administrador', 'Técnico', 'Secretaria', 'Supervisor', 'Cliente')
  @ApiOperation({ summary: 'Obtener órdenes asociadas a un equipo' })
  async getOrdersByEquipment(
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
    @Req() req: any,
  ) {
    const workOrders =
      await this.workOrdersService.getWorkOrdersByEquipment(equipmentId);

    return {
      message: 'Órdenes del equipo obtenidas',
      data: workOrders.map((wo) => this.mapToResponseDto(wo)),
    };
  }

  @Get('client/:clienteEmpresaId/category/:category')
  @Roles('Administrador', 'Secretaria', 'Técnico', 'Cliente')
  @ApiOperation({ summary: 'Obtener órdenes por cliente empresa y categoría' })
  async getWorkOrdersByClientAndCategory(
    @Param('clienteEmpresaId', ParseIntPipe) clienteEmpresaId: number,
    @Param('category') category: string,
  ) {
    const workOrders =
      await this.workOrdersService.getWorkOrdersByClientAndCategory(
        clienteEmpresaId,
        category,
      );

    const ordersWithCosts = await Promise.all(
      workOrders.map(async (order) => {
        const costs = await this.workOrdersService.calculateTotalCost(
          order.ordenId,
        );
        return {
          ...this.mapToResponseDto(order),
          ...costs,
        };
      }),
    );

    return {
      message: 'Órdenes obtenidas exitosamente',
      data: ordersWithCosts,
    };
  }

  @Post(':id/supplies')
  @Roles('Administrador', 'Técnico', 'Secretaria', 'Supervisor')
  @ApiOperation({ summary: 'Agregar un insumo usado a la orden' })
  async addSupplyDetail(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddSupplyDetailDto,
  ) {
    const detail = await this.workOrdersService.addSupplyDetail(id, dto);
    return {
      message: 'Detalle de insumo agregado correctamente',
      data: detail,
    };
  }

  @Delete(':id/supplies/:detalleInsumoId')
  @Roles('Administrador', 'Técnico', 'Secretaria', 'Supervisor')
  @ApiOperation({ summary: 'Eliminar un insumo usado de la orden' })
  async removeSupplyDetail(
    @Param('id', ParseIntPipe) id: number,
    @Param('detalleInsumoId', ParseIntPipe) detalleInsumoId: number,
  ) {
    await this.workOrdersService.removeSupplyDetail(id, detalleInsumoId);
    return {
      message: 'Detalle de insumo eliminado correctamente',
    };
  }

  @Post(':id/tools')
  @Roles('Administrador', 'Técnico', 'Secretaria', 'Supervisor')
  @ApiOperation({ summary: 'Agregar una herramienta usada a la orden' })
  async addToolDetail(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddToolDetailDto,
  ) {
    const detail = await this.workOrdersService.addToolDetail(id, dto);
    return {
      message: 'Detalle de herramienta agregado correctamente',
      data: detail,
    };
  }

  @Delete(':id/tools/:detalleHerramientaId')
  @Roles('Administrador', 'Técnico', 'Secretaria', 'Supervisor')
  @ApiOperation({ summary: 'Eliminar una herramienta usada de la orden' })
  async removeToolDetail(
    @Param('id', ParseIntPipe) id: number,
    @Param('detalleHerramientaId', ParseIntPipe)
    detalleHerramientaId: number,
  ) {
    await this.workOrdersService.removeToolDetail(id, detalleHerramientaId);
    return {
      message: 'Detalle de herramienta eliminado correctamente',
    };
  }

  @Post(':id/invoice')
  @Roles('Administrador', 'Secretaria')
  @ApiOperation({ summary: 'Subir factura PDF para una orden finalizada' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/invoices',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname) || '.pdf';
          cb(null, `invoice-${req.params.id}-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadInvoice(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se ha subido ningún archivo');
    }

    const workOrder = await this.workOrdersService.uploadInvoice(id, file);
    const costs = await this.workOrdersService.calculateTotalCost(id);

    return {
      message: 'Factura subida correctamente',
      data: {
        ...this.mapToResponseDto(workOrder),
        ...costs,
      },
    };
  }

  private mapToResponseDto(workOrder: WorkOrder): WorkOrderResponseDto {
    const technicians =
      workOrder.technicians?.map((tech) => ({
        id: tech.id,
        tecnicoId: tech.tecnicoId,
        isLeader: tech.isLeader,
        technician: {
          usuarioId: tech.technician?.usuarioId || 0,
          nombre: tech.technician?.nombre || '',
          apellido: tech.technician?.apellido || '',
          email: tech.technician?.email ?? undefined,
          telefono: tech.technician?.telefono ?? undefined,
          cedula: tech.technician?.cedula ?? undefined,
        },
      })) || [];

    const supplyDetails =
      workOrder.supplyDetails?.map((detail) => ({
        detalleInsumoId: detail.detalleInsumoId,
        cantidadUsada: Number(detail.cantidadUsada),
        costoUnitarioAlMomento: Number(detail.costoUnitarioAlMomento || 0),
        nombreInsumo: detail.supply?.nombre || '',
      })) || [];

    const toolDetails =
      workOrder.toolDetails?.map((detail) => ({
        detalleHerramientaId: detail.detalleHerramientaId,
        tiempoUso: detail.tiempoUso || '',
        nombreHerramienta: detail.tool?.nombre || '',
        marca: detail.tool?.marca || '',
      })) || [];

    const equipments =
      workOrder.equipmentWorkOrders?.map((ewo) => {
        const equipment = ewo.equipment;

        // Área - CORREGIDO: usar 'nombre' en lugar de 'nombreArea'
        let area = null as AreaInfo | null;
        if (equipment?.area && equipment.areaId) {
          area = {
            areaId: equipment.areaId,
            nombre: equipment.area.nombreArea || '', // 👈 CAMBIADO de 'nombreArea' a 'nombre'
          };
        }

        // Subárea - CORREGIDO: usar 'nombre' en lugar de 'nombreSubArea'
        let subArea = null as SubAreaInfo | null;
        if (equipment?.subArea && equipment.subAreaId) {
          subArea = {
            subAreaId: equipment.subAreaId,
            nombre: equipment.subArea.nombreSubArea || '', // 👈 CAMBIADO de 'nombreSubArea' a 'nombre'
          };
        }

        return {
          equipmentId: equipment?.equipmentId ?? 0,
          code: equipment?.code ?? '',
          category: equipment?.category ?? ('' as ServiceCategory),
          status: equipment?.status ?? '',
          area,
          subArea,
        };
      }) || [];

    const timers =
      workOrder.timers?.map((timer) => ({
        timerId: timer.timerId,
        startTime: timer.startTime,
        endTime: timer.endTime,
        totalSeconds: timer.totalSeconds,
      })) || [];

    const pauses =
      workOrder.pauses?.map((pause) => ({
        pauseId: pause.pauseId,
        startTime: pause.startTime,
        endTime: pause.endTime,
        observacion: pause.observacion || '',
        user: {
          usuarioId: pause.user?.usuarioId || 0,
          nombre: pause.user?.nombre || '',
          apellido: pause.user?.apellido || '',
          email: pause.user?.email ?? undefined,
          telefono: pause.user?.telefono ?? undefined,
          cedula: pause.user?.cedula ?? undefined,
        },
      })) || [];

    // CORRECCIÓN: Manejar el caso cuando service es null
    const serviceInfo = workOrder.service
      ? {
          servicioId: workOrder.service.servicioId,
          nombreServicio: workOrder.service.nombreServicio,
          categoriaServicio: workOrder.service.categoriaServicio,
        }
      : {
          servicioId: 0,
          nombreServicio: '',
          categoriaServicio: undefined,
        };

    return {
      ordenId: workOrder.ordenId,
      fechaSolicitud: workOrder.fechaSolicitud,
      fechaInicio: workOrder.fechaInicio,
      fechaFinalizacion: workOrder.fechaFinalizacion,
      estado: workOrder.estado,
      tipoServicio: workOrder.tipoServicio ?? null,

      maintenanceType: workOrder.maintenanceType
        ? {
            id: workOrder.maintenanceType.id,
            nombre: workOrder.maintenanceType.nombre,
          }
        : null,

      comentarios: workOrder.comentarios,
      estadoFacturacion: workOrder.estadoFacturacion,
      facturaPdfUrl: workOrder.facturaPdfUrl,
      service: serviceInfo, // Usar la variable corregida
      cliente: workOrder.cliente
        ? {
            usuarioId: workOrder.cliente.usuarioId,
            nombre: workOrder.cliente.nombre,
            apellido: workOrder.cliente.apellido || undefined,
            email: workOrder.cliente.email ?? undefined,
            telefono: workOrder.cliente.telefono ?? undefined,
            cedula: workOrder.cliente.cedula ?? undefined,
          }
        : null,
      clienteEmpresa: workOrder.clienteEmpresa
        ? {
            idCliente: workOrder.clienteEmpresa.idCliente,
            nombre: workOrder.clienteEmpresa.nombre,
            nit: workOrder.clienteEmpresa.nit,
            email: workOrder.clienteEmpresa.email ?? undefined,
            telefono: workOrder.clienteEmpresa.telefono ?? undefined,
            localizacion: workOrder.clienteEmpresa.localizacion ?? undefined,
          }
        : null,
      technicians,
      equipos: equipments,
      supplyDetails,
      toolDetails,
      timers,
      pauses,
      costoTotalInsumos: 0,
      tiempoTotal: 0,
      isEmergency: workOrder.isEmergency || false,
      planMantenimientoId: workOrder.planMantenimientoId,
    };
  }
}
