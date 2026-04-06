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
  Res,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { RateTechniciansDto } from './dto/rate-technicians.dto';
import { SignWorkOrderDto } from './dto/sign-work-order.dto';
import { AcInspectionPhase, ServiceCategory } from '../shared/index';
import { CreateAcInspectionDto } from './dto/create-ac-inspection.dto';
import { Response } from 'express';
import { LightSerializerInterceptor } from '../common/interceptors/light-serializer.interceptor';
import { CloudinaryService } from '../images/cloudinary.service';
import { WoReportsQueueService } from '../wo-reports/wo-reports.queue.service';
import { WoReportsTokenStore } from '../wo-reports/wo-reports.token-store';
import { SupabaseTempStorageService } from '../wo-reports/supabase-temp-storage.service';
import { CreateAsyncReportDto } from '../wo-reports/dto/create-async-report.dto';
import { CreateBatchAsyncReportDto } from '../wo-reports/dto/create-batch-async-report.dto';
import { CreateClientsAsyncReportDto } from '../wo-reports/dto/create-clients-async-report.dto';

@ApiTags('work-orders')
@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WorkOrdersController {
  constructor(
    private readonly workOrdersService: WorkOrdersService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly woReportsQueue: WoReportsQueueService,
    private readonly tokenStore: WoReportsTokenStore,
    private readonly tempStorage: SupabaseTempStorageService,
  ) { }

  private getRoleName(user: any): string {
    return user?.role?.nombreRol || user?.role || '';
  }

  @Post()
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
  @ApiOperation({
    summary:
      'Obtener órdenes de trabajo (filtradas por rol: técnico/cliente solo ven las suyas, a menos que se use ?all=true)',
  })
  @ApiQuery({
    name: 'all',
    required: false,
    type: Boolean,
    description:
      'Si es true y el usuario es técnico, devuelve todas las órdenes',
  })
  async findAll(@Req() req: any, @Query('all') all?: string) {
    const roleName = this.getRoleName(req.user);
    const showAll = all === 'true';

    let data: WorkOrder[];

    if (roleName === 'Técnico' && showAll) {
      data = await this.workOrdersService.findAll();
    } else if (roleName === 'Técnico') {
      data = await this.workOrdersService.getWorkOrdersByTechnician(req.user.userId);
    } else if (roleName === 'Cliente') {
      data = await this.workOrdersService.getWorkOrdersForClientUser(req.user.userId);
    } else {
      data = await this.workOrdersService.findAll();
    }

    // ✅ 2 queries para costos/tiempo en lote (no N+1)
    const ids = data.map((o) => o.ordenId);
    const totalsMap = await this.workOrdersService.calculateTotalsForOrders(ids);

    const ordersWithCosts = data.map((order) => {
      const totals = totalsMap.get(order.ordenId) ?? {
        costoTotalInsumos: 0,
        tiempoTotal: 0,
      };

      return {
        ...this.mapToResponseDto(order),
        ...totals,
      };
    });

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

    if (roleName === 'Cliente') {
      // Permitir si la orden pertenece a una empresa del usuario
      const hasAccess = await this.workOrdersService.userHasAccessToEmpresa(
        req.user.userId,
        workOrder.clienteEmpresaId,
      );

      if (!hasAccess) {
        throw new ForbiddenException();
      }
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
  @ApiOperation({ summary: 'Actualizar una orden de trabajo' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkOrderDto,
    @Req() req: any,
  ) {
    const clientId = req.headers['x-socket-id'] as string;
    const workOrder = await this.workOrdersService.update(
      id,
      dto,
      req.user,
      clientId,
    );
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
  @ApiOperation({ summary: 'Eliminar una orden de trabajo' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.workOrdersService.remove(id);
    return {
      message: 'Orden de trabajo eliminada exitosamente',
    };
  }

  @Patch(':id/assign-technician')
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
  @ApiOperation({ summary: 'Subir factura PDF para una orden finalizada' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadInvoice(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('estadoPago') estadoPago?: string, // ← Recibir el estado de pago del frontend
  ) {
    if (!file) {
      throw new BadRequestException('No se ha subido ningún archivo');
    }

    // Validar que sea un PDF
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('El archivo debe ser un PDF');
    }

    // Validar tamaño máximo (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('El archivo no puede ser mayor a 10MB');
    }

    try {
      // Subir a Cloudinary como tipo 'raw' para PDFs
      const uploadResult = await this.cloudinaryService.upload(
        file,
        `invoices/${id}`,
        'raw',
      );

      // Actualizar la orden con la URL de Cloudinary y el estado de pago seleccionado
      const workOrder = await this.workOrdersService.uploadInvoice(
        id,
        uploadResult.secure_url,
        estadoPago, // ← Pasar el estado al servicio
      );

      const costs = await this.workOrdersService.calculateTotalCost(id);

      return {
        message: 'Factura subida correctamente a Cloudinary',
        data: {
          ...this.mapToResponseDto(workOrder),
          ...costs,
          invoiceUrl: uploadResult.secure_url,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al subir la factura: ${error.message}`,
      );
    }
  }

  // Opcional: Endpoint para eliminar factura
  @Delete(':id/invoice')
  @ApiOperation({ summary: 'Eliminar factura de una orden' })
  async deleteInvoice(@Param('id', ParseIntPipe) id: number) {
    const workOrder = await this.workOrdersService.findOne(id);

    if (!workOrder.facturaPdfUrl) {
      throw new BadRequestException('La orden no tiene factura asociada');
    }

    const urlParts = workOrder.facturaPdfUrl.split('/');
    const publicIdWithExt = urlParts
      .slice(urlParts.indexOf('upload') + 2)
      .join('/');
    const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ''); // Quitar extensión

    try {
      await this.cloudinaryService.delete(publicId, 'raw');
    } catch (error) {
      console.error('Error eliminando de Cloudinary:', error);
    }

    const updated = await this.workOrdersService.removeInvoice(id);

    return {
      message: 'Factura eliminada correctamente',
      data: this.mapToResponseDto(updated),
    };
  }

  @Post(':id/rate-technicians')
  @ApiOperation({
    summary: 'Calificar el desempeño de los técnicos de una orden completada',
  })
  async rateTechnicians(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RateTechniciansDto,
    @Req() req: any,
  ) {
    const workOrder = await this.workOrdersService.rateTechnicians(
      id,
      dto,
      req.user,
    );
    const costs = await this.workOrdersService.calculateTotalCost(id);

    return {
      message: 'Técnicos calificados correctamente',
      data: {
        ...this.mapToResponseDto(workOrder),
        ...costs,
      },
    };
  }

  @Post(':id/sign-receipt')
  @ApiOperation({
    summary: 'Registrar firma de recibido de la orden de servicio',
  })
  async signReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SignWorkOrderDto,
    @Req() req: any,
  ) {
    const workOrder = await this.workOrdersService.signReceipt(
      id,
      dto,
      req.user,
    );
    const costs = await this.workOrdersService.calculateTotalCost(id);

    return {
      message: 'Firma de recibido registrada exitosamente',
      data: {
        ...this.mapToResponseDto(workOrder),
        ...costs,
      },
    };
  }

  @Post(':id/ac-inspections/before')
  @ApiOperation({
    summary:
      'Registrar inspección inicial (antes del mantenimiento) para aire acondicionado',
  })
  async createAcInspectionBefore(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAcInspectionDto,
    @Req() req: any,
  ) {
    const inspection = await this.workOrdersService.createAcInspection(
      id,
      AcInspectionPhase.BEFORE,
      dto,
      req.user,
    );

    return {
      message: 'Inspección inicial registrada correctamente',
      data: inspection,
    };
  }

  @Post(':id/ac-inspections/after')
  @ApiOperation({
    summary:
      'Registrar inspección final (después del mantenimiento) para aire acondicionado',
  })
  async createAcInspectionAfter(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAcInspectionDto,
    @Req() req: any,
  ) {
    const inspection = await this.workOrdersService.createAcInspection(
      id,
      AcInspectionPhase.AFTER,
      dto,
      req.user,
    );

    return {
      message: 'Inspección final registrada correctamente',
      data: inspection,
    };
  }

  @Get('light')
  @ApiOperation({
    summary: 'Obtener versiones ligeras de órdenes (para tiempo real)',
  })
  @UseInterceptors(
    new LightSerializerInterceptor([
      'ordenId',
      'estado',
      'fechaCreacion',
      'clienteId',
    ]),
  )
  async findAllLight(@Req() req: any) {
    const roleName = this.getRoleName(req.user);
    let data: WorkOrder[];

    if (roleName === 'Técnico') {
      data = await this.workOrdersService.getWorkOrdersByTechnician(
        req.user.userId,
      );
    } else if (roleName === 'Cliente') {
      data = await this.workOrdersService.getWorkOrdersForClientUser(
        req.user.userId,
      );
    } else {
      data = await this.workOrdersService.findAll();
    }

    // Limitar a 100 registros máximo
    if (data.length > 100) {
      data = data.slice(0, 100);
    }

    return {
      message: 'Órdenes ligeras obtenidas',
      data: data.map((wo) => ({
        ordenId: wo.ordenId,
        estado: wo.estado,
        fechaCreacion: wo.fechaSolicitud,
        clienteId: wo.clienteId,
      })),
    };
  }

  @Post('reports/clients-async')
  @ApiOperation({
    summary: 'Enviar reportes a clientes en segundo plano',
  })
  async sendReportsToClientsAsync(
    @Body() dto: CreateClientsAsyncReportDto,
    @Req() req: any,
  ) {
    const roleName = this.getRoleName(req.user);

    if (!['Administrador', 'Secretaria', 'Supervisor'].includes(roleName)) {
      throw new ForbiddenException(
        'No tiene permisos para enviar reportes a clientes',
      );
    }

    const { jobId } = await this.woReportsQueue.enqueue({
      kind: 'clients',
      userId: req.user.userId,
      orderIds: dto.orderIds,
      message: dto.message,
    });

    return {
      message: 'Envío a clientes encolado correctamente',
      data: { jobId },
    };
  }

  @Post(':id/informe-async')
  @ApiOperation({
    summary: 'Generar informe en segundo plano (download/email)',
  })
  async generarInformeAsync(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAsyncReportDto,
    @Req() req: any,
  ) {
    const workOrder = await this.workOrdersService.findOne(id);
    const roleName = this.getRoleName(req.user);

    if (roleName === 'Técnico') {
      const isAssigned = workOrder.technicians?.some(
        (t) => t.tecnicoId === req.user.userId,
      );
      if (!isAssigned) throw new ForbiddenException();
    }

    if (roleName === 'Cliente') {
      const hasAccess = await this.workOrdersService.userHasAccessToEmpresa(
        req.user.userId,
        workOrder.clienteEmpresaId,
      );
      if (!hasAccess) throw new ForbiddenException();
    }

    if (dto.action === 'email' && !dto.toEmail) {
      throw new BadRequestException('toEmail es requerido cuando action=email');
    }

    const { jobId } = await this.woReportsQueue.enqueue({
      kind: 'single',
      userId: req.user.userId,
      ordenId: id,
      reportType: dto.reportType,
      action: dto.action,
      toEmail: dto.toEmail,
      ccEmails: dto.ccEmails,
    });

    return {
      message: 'Reporte encolado correctamente',
      data: { jobId },
    };
  }

  @Get('informe-download/:token')
  @ApiOperation({ summary: 'Descargar PDF/ZIP generado (token expira, 1 uso real al finalizar)' })
  async downloadInforme(@Param('token') token: string, @Res() res: Response) {
    const payload = await this.tokenStore.getToken(token);
    if (!payload) {
      throw new NotFoundException('El token no existe o expiró');
    }

    const buffer = await this.tempStorage.downloadFile({
      path: payload.objectPath,
    });

    const contentType =
      payload.contentType ||
      (payload.fileName.toLowerCase().endsWith('.zip')
        ? 'application/zip'
        : 'application/pdf');

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${payload.fileName}"`,
    );
    res.setHeader('Content-Length', buffer.length);

    res.on('finish', async () => {
      try {
        await this.tokenStore.deleteToken(token);
        await this.tempStorage.remove([payload.objectPath]);
      } catch (e) {
        console.error('Error limpiando token/archivo:', e);
      }
    });

    return res.status(200).send(buffer);
  }

  @Post('reports/batch-async')
  @ApiOperation({
    summary:
      'Generar o enviar lote de reportes en segundo plano (download/email)',
  })
  async generarBatchAsync(
    @Body() dto: CreateBatchAsyncReportDto,
    @Req() req: any,
  ) {
    const roleName = this.getRoleName(req.user);

    if (dto.action === 'email' && !dto.toEmail) {
      throw new BadRequestException('toEmail es requerido cuando action=email');
    }

    // Validación básica de acceso por orden
    for (const orderId of dto.orderIds) {
      const workOrder = await this.workOrdersService.findOne(orderId);

      if (roleName === 'Técnico') {
        const isAssigned = workOrder.technicians?.some(
          (t) => t.tecnicoId === req.user.userId,
        );
        if (!isAssigned) {
          throw new ForbiddenException(`No tiene acceso a la orden ${orderId}`);
        }
      }

      if (roleName === 'Cliente') {
        const hasAccess = await this.workOrdersService.userHasAccessToEmpresa(
          req.user.userId,
          workOrder.clienteEmpresaId,
        );
        if (!hasAccess) {
          throw new ForbiddenException(`No tiene acceso a la orden ${orderId}`);
        }
      }
    }

    const { jobId } = await this.woReportsQueue.enqueue({
      kind: 'batch',
      userId: req.user.userId,
      orderIds: dto.orderIds,
      reportType: dto.reportType,
      action: dto.action,
      toEmail: dto.toEmail,
      ccEmails: dto.ccEmails,
    });

    return {
      message: 'Lote de reportes encolado correctamente',
      data: { jobId },
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
        rating: tech.rating ?? null,
        ratedByUserId: tech.ratedByUserId ?? null,
        ratedAt: tech.ratedAt ?? null,
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

        let area = null as AreaInfo | null;
        if (equipment?.area && equipment.areaId) {
          area = {
            areaId: equipment.areaId,
            nombre: equipment.area.nombreArea || '',
          };
        }

        let subArea = null as SubAreaInfo | null;
        if (equipment?.subArea && equipment.subAreaId) {
          subArea = {
            subAreaId: equipment.subAreaId,
            nombre: equipment.subArea.nombreSubArea || '',
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

    const acInspections =
      workOrder.acInspections?.map((insp) => ({
        id: insp.id,
        equipmentId: insp.equipmentId,
        phase: insp.phase,
        evapTempSupply: insp.evapTempSupply,
        evapTempReturn: insp.evapTempReturn,
        evapTempAmbient: insp.evapTempAmbient,
        evapTempOutdoor: insp.evapTempOutdoor,
        evapMotorRpm: insp.evapMotorRpm,
        evapMicrofarads: insp.evapMicrofarads ?? null,
        condHighPressure: insp.condHighPressure,
        condLowPressure: insp.condLowPressure,
        condAmperage: insp.condAmperage,
        condVoltage: insp.condVoltage,
        condTempIn: insp.condTempIn,
        condTempDischarge: insp.condTempDischarge,
        condMotorRpm: insp.condMotorRpm,
        condMicrofarads: insp.condMicrofarads ?? null,
        compressorOhmio: insp.compressorOhmio ?? null,
        observation: insp.observation ?? null,
        createdAt: insp.createdAt,
      })) || [];

    const images =
      workOrder.images?.map((img) => ({
        id: img.id,
        url: img.url,
        evidencePhase: img.evidencePhase ?? null,
        equipmentId: img.equipmentId ?? null,
        observation: img.observation ?? null,
        createdAt: img.created_at,
      })) || [];

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
      estadoPago: workOrder.estadoPago,
      facturaPdfUrl: workOrder.facturaPdfUrl,
      service: serviceInfo,
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
      receivedByName: workOrder.receivedByName ?? null,
      receivedByPosition: workOrder.receivedByPosition ?? null,
      receivedBySignatureData: workOrder.receivedBySignatureData ?? null,
      receivedAt: workOrder.receivedAt ?? null,
      acInspections,
      images,
    };
  }
}
