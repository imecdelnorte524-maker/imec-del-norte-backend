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
  ApiQuery,
} from '@nestjs/swagger';
import { WorkOrdersService } from './work-orders.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { AddSupplyDetailDto } from './dto/add-supply-detail.dto';
import { AddToolDetailDto } from './dto/add-tool-detail.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { WorkOrderResponseDto } from './dto/work-order-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WorkOrder } from './entities/work-order.entity';
import { diskStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';

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

    if (roleName === 'Técnico' && workOrder.tecnicoId !== req.user.userId) {
      throw new ForbiddenException();
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
  async cancelByClient(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const workOrder = await this.workOrdersService.cancelByClient(
      id,
      req.user,
    );
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
  @ApiOperation({ summary: 'Asignar o cambiar el técnico de una orden' })
  async assignTechnician(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignTechnicianDto,
  ) {
    const workOrder = await this.workOrdersService.assignTechnician(
      id,
      dto.tecnicoId,
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

  @Delete(':id/technician')
  @Roles('Administrador', 'Secretaria', 'Supervisor')
  @ApiOperation({ summary: 'Quitar técnico de una orden de trabajo' })
  async unassignTechnician(@Param('id', ParseIntPipe) id: number) {
    const workOrder = await this.workOrdersService.unassignTechnician(id);
    const costs = await this.workOrdersService.calculateTotalCost(id);

    return {
      message: 'Técnico removido de la orden correctamente',
      data: {
        ...this.mapToResponseDto(workOrder),
        ...costs,
      },
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

    return {
      ordenId: workOrder.ordenId,
      fechaSolicitud: workOrder.fechaSolicitud,
      fechaInicio: workOrder.fechaInicio,
      fechaFinalizacion: workOrder.fechaFinalizacion,
      estado: workOrder.estado,
      comentarios: workOrder.comentarios,
      estadoFacturacion: workOrder.estadoFacturacion,
      facturaPdfUrl: workOrder.facturaPdfUrl,
      service: workOrder.service,
      cliente: workOrder.cliente ? { ...workOrder.cliente, apellido: workOrder.cliente.apellido || '' } : null,
      clienteEmpresa: workOrder.clienteEmpresa,
      tecnico: workOrder.tecnico ? { ...workOrder.tecnico, apellido: workOrder.tecnico.apellido || '' } : null,
      equipos:
        workOrder.equipments?.map((e) => ({
          equipmentId: e.equipmentId,
          name: e.name,
          code: e.code,
          category: e.category,
        })) || [],
      supplyDetails,
      toolDetails,
      costoTotalEstimado: 0,
      costoTotalInsumos: 0,
    };
  }
}