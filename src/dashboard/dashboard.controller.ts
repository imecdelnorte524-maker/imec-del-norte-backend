// src/dashboard/dashboard.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Helper para obtener el rol del usuario
   */
  private getUserRole(user: any): string {
    return user?.role?.nombreRol || user?.role || '';
  }

  @Get('metricas')
  @Roles('Administrador', 'Técnico', 'Secretaria', 'Supervisor', 'Cliente')
  @ApiOperation({ summary: 'Obtener métricas generales del dashboard' })
  async getMetrics(@Req() req: any) {
    const metrics = await this.dashboardService.getMetrics(req.user);

    return {
      message: 'Métricas obtenidas exitosamente',
      data: metrics,
    };
  }

  @Get('ordenes-servicio')
  @Roles('Administrador', 'Secretaria', 'Supervisor')
  @ApiOperation({
    summary:
      'Obtener órdenes de servicio para el dashboard (vista administrador)',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    description: 'Estado filtrado (Pendiente, En Proceso, Completado, etc.)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Texto de búsqueda (cliente, servicio, técnico, ID orden)',
  })
  @ApiQuery({
    name: 'fecha_inicio',
    required: false,
    description: 'Fecha inicio (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'fecha_fin',
    required: false,
    description: 'Fecha fin (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Página (paginación)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Límite por página (paginación)',
  })
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
  @Roles('Técnico', 'Cliente')
  @ApiOperation({
    summary: 'Obtener órdenes de servicio del usuario actual (técnico o cliente)',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    description: 'Estado filtrado (Pendiente, En Proceso, Completado, etc.)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Texto de búsqueda (cliente, servicio, técnico, ID orden)',
  })
  @ApiQuery({
    name: 'fecha_inicio',
    required: false,
    description: 'Fecha inicio (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'fecha_fin',
    required: false,
    description: 'Fecha fin (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Página (paginación)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Límite por página (paginación)',
  })
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
}