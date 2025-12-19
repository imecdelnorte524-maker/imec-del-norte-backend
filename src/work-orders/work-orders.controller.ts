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
  async findAll(@Req() req: any) {
    const data = await this.workOrdersService.findAll();

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
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const workOrder = await this.workOrdersService.findOne(id);
    const roleName = this.getRoleName(req.user);

    if (
      roleName === 'Técnico' &&
      workOrder.tecnicoId !== req.user.userId
    ) {
      throw new ForbiddenException();
    }

    if (
      roleName === 'Cliente' &&
      workOrder.clienteId !== req.user.userId
    ) {
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

  private mapToResponseDto(workOrder: WorkOrder): WorkOrderResponseDto {
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
      cliente: workOrder.cliente,
      clienteEmpresa: workOrder.clienteEmpresa,
      tecnico: workOrder.tecnico,
      equipos: workOrder.equipments?.map((e) => ({
        equipmentId: e.equipmentId,
        name: e.name,
        code: e.code,
        category: e.category,
      })) || [],
      supplyDetails: [],
      toolDetails: [],
      costoTotalEstimado: 0,
      costoTotalInsumos: 0,
    };
  }
}
