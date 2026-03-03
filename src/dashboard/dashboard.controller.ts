// src/dashboard/dashboard.controller.ts
import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  private getUserRole(user: any): string {
    return user?.role?.nombreRol || user?.role || '';
  }

  @Get('metricas')
  @ApiOperation({ summary: 'Obtener métricas generales del dashboard' })
  async getMetrics(@Req() req: any) {
    const metrics = await this.dashboardService.getMetrics(req.user);
    return {
      message: 'Métricas obtenidas exitosamente',
      data: metrics,
    };
  }

  @Get('ordenes-servicio')
  @ApiOperation({ summary: 'Obtener órdenes de servicio para el dashboard' })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'fecha_inicio', required: false })
  @ApiQuery({ name: 'fecha_fin', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAllOrders(
    @Query('estado') estado?: string,
    @Query('search') search?: string,
    @Query('fecha_inicio') fechaInicio?: string,
    @Query('fecha_fin') fechaFin?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    const data = await this.dashboardService.getDashboardOrders({
      estado: estado || undefined,
      search: search || undefined,
      startDate: fechaInicio || undefined,
      endDate: fechaFin || undefined,
      page: pageNum,
      limit: limitNum,
    });

    return {
      message: 'Órdenes de servicio obtenidas exitosamente',
      data,
    };
  }

  @Get('mis-servicios')
  @ApiOperation({ summary: 'Obtener órdenes de servicio del usuario actual' })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'fecha_inicio', required: false })
  @ApiQuery({ name: 'fecha_fin', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getMyServices(
    @Req() req: any,
    @Query('estado') estado?: string,
    @Query('search') search?: string,
    @Query('fecha_inicio') fechaInicio?: string,
    @Query('fecha_fin') fechaFin?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    const userRole = this.getUserRole(req.user);
    const userId = req.user?.userId;

    const data = await this.dashboardService.getMyServices({
      estado: estado || undefined,
      search: search || undefined,
      startDate: fechaInicio || undefined,
      endDate: fechaFin || undefined,
      page: pageNum,
      limit: limitNum,
      userRole,
      userId,
    });

    return {
      message: 'Mis órdenes de servicio obtenidas exitosamente',
      data,
    };
  }

  @Get('orders')
  @ApiOperation({ summary: 'Obtener órdenes de servicio (alias en inglés)' })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'fecha_inicio', required: false })
  @ApiQuery({ name: 'fecha_fin', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'tecnicoId', required: false })
  @ApiQuery({ name: 'clienteId', required: false })
  async getOrders(
    @Query('estado') estado?: string,
    @Query('search') search?: string,
    @Query('fecha_inicio') fechaInicio?: string,
    @Query('fecha_fin') fechaFin?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tecnicoId') tecnicoId?: string,
    @Query('clienteId') clienteId?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const tecnicoIdNum = tecnicoId ? parseInt(tecnicoId, 10) : undefined;
    const clienteIdNum = clienteId ? parseInt(clienteId, 10) : undefined;

    const data = await this.dashboardService.getDashboardOrders({
      estado: estado || undefined,
      search: search || undefined,
      startDate: fechaInicio || undefined,
      endDate: fechaFin || undefined,
      page: pageNum,
      limit: limitNum,
      tecnicoId: tecnicoIdNum,
      clienteId: clienteIdNum,
    });

    return {
      message: 'Órdenes de servicio obtenidas exitosamente',
      data,
    };
  }
}
