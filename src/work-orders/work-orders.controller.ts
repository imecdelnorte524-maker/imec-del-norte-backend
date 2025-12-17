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

@ApiTags('work-orders')
@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  private getRoleName(user: any): string {
    // Soporta tanto req.user.role (string) como user.role.nombreRol (entidad)
    return user?.role?.nombreRol || user?.role || '';
  }

  @Post()
  @Roles('Administrador', 'Cliente')
  @ApiOperation({
    summary: 'Crear orden de trabajo',
    description: 'Crea una nueva orden de trabajo',
  })
  @ApiResponse({
    status: 201,
    description: 'Orden de trabajo creada exitosamente',
  })
  async create(
    @Body() createWorkOrderDto: CreateWorkOrderDto,
    @Req() req: any,
  ) {
    const workOrder = await this.workOrdersService.create(
      createWorkOrderDto,
      req.user,
    );
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
    summary: 'Obtener órdenes de trabajo',
    description:
      'Obtiene la lista de órdenes de trabajo, filtrada según el rol del usuario',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    description:
      'Filtrar por estado (Solicitada sin asignar, Solicitada asignada, En proceso, Finalizada, Cancelada)',
  })
  @ApiQuery({
    name: 'cliente',
    required: false,
    description: 'Filtrar por ID de cliente (usuario contacto)',
  })
  @ApiQuery({
    name: 'tecnico',
    required: false,
    description: 'Filtrar por ID de técnico',
  })
  @ApiQuery({
    name: 'fecha-inicio',
    required: false,
    description: 'Fecha de inicio del rango (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'fecha-fin',
    required: false,
    description: 'Fecha de fin del rango (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'stats',
    required: false,
    description: 'Obtener estadísticas de órdenes de trabajo (solo Admin)',
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'Órdenes de trabajo obtenidas exitosamente',
  })
  async findAll(
    @Query('estado') estado?: string,
    @Query('cliente') clienteQuery?: string,
    @Query('tecnico') tecnicoQuery?: string,
    @Query('fecha-inicio') fechaInicio?: string,
    @Query('fecha-fin') fechaFin?: string,
    @Query('stats') stats?: string,
    @Req() req?: any,
  ) {
    const currentUser = req.user;
    const roleName = this.getRoleName(currentUser);
    let data: WorkOrder[] | any;

    const statsFlag = stats === 'true' || stats === '1';

    if (statsFlag) {
      if (roleName !== 'Administrador') {
        throw new ForbiddenException(
          'Solo el Administrador puede ver estadísticas de órdenes',
        );
      }
      data = await this.workOrdersService.getWorkOrderStats();
      return {
        message: 'Estadísticas de órdenes de trabajo obtenidas exitosamente',
        data,
      };
    }

    const hasDateRange = fechaInicio && fechaFin;

    // LÓGICA DE FILTRADO

    // CASO 1: CLIENTE (Solo ve lo suyo)
    if (roleName === 'Cliente') {
      const myId = currentUser.userId; // ✅ usar userId del JWT

      if (hasDateRange) {
        const startDate = new Date(fechaInicio as string);
        const endDate = new Date(fechaFin as string);
        endDate.setHours(23, 59, 59, 999);
        const allInRange =
          await this.workOrdersService.getWorkOrdersByDateRange(
            startDate,
            endDate,
          );
        data = allInRange.filter((o) => o.clienteId === myId);
      } else if (estado) {
        const byStatus =
          await this.workOrdersService.getWorkOrdersByStatus(estado);
        data = byStatus.filter((o) => o.clienteId === myId);
      } else {
        // Caso base: todas MIS órdenes
        data = await this.workOrdersService.getWorkOrdersByClient(myId);
      }
    }

    // CASO 2: TÉCNICO (Solo ve lo asignado a él)
    else if (roleName === 'Técnico' || roleName === 'Tecnico') {
      const myId = currentUser.userId; // ✅ usar userId del JWT

      if (hasDateRange) {
        const startDate = new Date(fechaInicio as string);
        const endDate = new Date(fechaFin as string);
        endDate.setHours(23, 59, 59, 999);
        const allInRange =
          await this.workOrdersService.getWorkOrdersByDateRange(
            startDate,
            endDate,
          );
        data = allInRange.filter((o) => o.tecnicoId === myId);
      } else if (estado) {
        const byStatus =
          await this.workOrdersService.getWorkOrdersByStatus(estado);
        data = byStatus.filter((o) => o.tecnicoId === myId);
      } else {
        // Caso base: todas MIS asignaciones
        data = await this.workOrdersService.getWorkOrdersByTechnician(myId);
      }
    }

    // CASO 3: ADMIN / SECRETARIA / SUPERVISOR (Ven todo, aplican filtros opcionales)
    else if (
      roleName === 'Administrador' ||
      roleName === 'Secretaria' ||
      roleName === 'Supervisor'
    ) {
      if (estado) {
        data = await this.workOrdersService.getWorkOrdersByStatus(estado);
      } else if (clienteQuery) {
        data = await this.workOrdersService.getWorkOrdersByClient(
          parseInt(clienteQuery, 10),
        );
      } else if (tecnicoQuery) {
        data = await this.workOrdersService.getWorkOrdersByTechnician(
          parseInt(tecnicoQuery, 10),
        );
      } else if (hasDateRange) {
        const startDate = new Date(fechaInicio as string);
        const endDate = new Date(fechaFin as string);
        endDate.setHours(23, 59, 59, 999);
        data = await this.workOrdersService.getWorkOrdersByDateRange(
          startDate,
          endDate,
        );
      } else {
        // Sin filtros: devolver TODO
        data = await this.workOrdersService.findAll();
      }
    }

    // CASO DEFAULT (Por seguridad, devolver vacío si el rol no coincide)
    else {
      console.warn(`Rol desconocido o sin permisos de lista: ${roleName}`);
      data = [];
    }

    const ordersWithCosts = await Promise.all(
      (data as WorkOrder[]).map(async (order) => {
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
  @Roles('Administrador', 'Técnico', 'Secretaria', 'Cliente', 'Supervisor')
  @ApiOperation({
    summary: 'Obtener orden de trabajo por ID',
    description:
      'Obtiene una orden de trabajo específica por su ID, según permisos del usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Orden de trabajo obtenida exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Orden de trabajo no encontrada' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const workOrder = await this.workOrdersService.findOne(id);
    const currentUser = req.user;
    const roleName = this.getRoleName(currentUser);

    // TÉCNICO: solo puede ver sus órdenes
    if (
      roleName === 'Técnico' &&
      workOrder.tecnicoId !== currentUser.userId // ✅
    ) {
      throw new ForbiddenException(
        'No tiene permiso para ver esta orden de trabajo',
      );
    }

    // CLIENTE: solo puede ver sus órdenes (clienteId)
    if (
      roleName === 'Cliente' &&
      workOrder.clienteId !== currentUser.userId // ✅
    ) {
      throw new ForbiddenException(
        'No tiene permiso para ver esta orden de trabajo',
      );
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
  @Roles('Administrador', 'Técnico', 'Secretaria')
  @ApiOperation({
    summary: 'Actualizar orden de trabajo',
    description: 'Actualiza una orden de trabajo existente',
  })
  @ApiResponse({
    status: 200,
    description: 'Orden de trabajo actualizada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Orden de trabajo no encontrada' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWorkOrderDto: UpdateWorkOrderDto,
    @Req() req: any,
  ) {
    const workOrder = await this.workOrdersService.update(
      id,
      updateWorkOrderDto,
      req.user,
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

  // Endpoint para que el CLIENTE cancele su propia orden (máx. 3 días hábiles)
  @Patch(':id/cancel')
  @Roles('Cliente')
  @ApiOperation({
    summary: 'Cancelar orden de trabajo (Cliente)',
    description:
      'Permite al cliente cancelar su propia orden dentro de los primeros 3 días hábiles',
  })
  @ApiResponse({
    status: 200,
    description: 'Orden de trabajo cancelada exitosamente',
  })
  async cancelByClient(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
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

  @Patch(':id/assign-technician')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Asignar técnico a una orden de trabajo',
    description:
      'Asigna un técnico a una orden de trabajo. Si la orden estaba "Solicitada sin asignar", pasa a "Solicitada asignada".',
  })
  @ApiResponse({
    status: 200,
    description: 'Técnico asignado exitosamente a la orden de trabajo',
  })
  @ApiResponse({ status: 404, description: 'Orden o técnico no encontrado' })
  async assignTechnician(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignTechnicianDto: AssignTechnicianDto,
  ) {
    const workOrder = await this.workOrdersService.assignTechnician(
      id,
      assignTechnicianDto.tecnicoId,
    );
    const costs = await this.workOrdersService.calculateTotalCost(id);

    return {
      message: 'Técnico asignado exitosamente a la orden de trabajo',
      data: {
        ...this.mapToResponseDto(workOrder),
        ...costs,
      },
    };
  }

  @Delete(':id')
  @Roles('Administrador')
  @ApiOperation({
    summary: 'Eliminar orden de trabajo',
    description: 'Elimina una orden de trabajo permanentemente',
  })
  @ApiResponse({
    status: 200,
    description: 'Orden de trabajo eliminada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Orden de trabajo no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'No se puede eliminar una orden finalizada o en proceso',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.workOrdersService.remove(id);
    return {
      message: 'Orden de trabajo eliminada exitosamente',
    };
  }

  @Post(':id/supplies')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Agregar insumo a orden de trabajo',
    description: 'Agrega un insumo usado en la orden de trabajo',
  })
  @ApiResponse({ status: 201, description: 'Insumo agregado exitosamente' })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo o insumo no encontrado',
  })
  @ApiResponse({ status: 409, description: 'Stock insuficiente' })
  async addSupplyDetail(
    @Param('id', ParseIntPipe) id: number,
    @Body() addSupplyDetailDto: AddSupplyDetailDto,
  ) {
    const supplyDetail = await this.workOrdersService.addSupplyDetail(
      id,
      addSupplyDetailDto,
    );
    return {
      message: 'Insumo agregado exitosamente a la orden de trabajo',
      data: supplyDetail,
    };
  }

  @Post(':id/tool')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Agregar herramienta a orden de trabajo',
    description: 'Agrega una herramienta asignada a la orden de trabajo',
  })
  @ApiResponse({
    status: 201,
    description: 'Herramienta agregada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo o herramienta no encontrado',
  })
  @ApiResponse({ status: 409, description: 'Herramienta no disponible' })
  async addToolDetail(
    @Param('id', ParseIntPipe) id: number,
    @Body() addToolDetailDto: AddToolDetailDto,
  ) {
    const toolDetail = await this.workOrdersService.addToolDetail(
      id,
      addToolDetailDto,
    );
    return {
      message: 'Herramienta agregada exitosamente a la orden de trabajo',
      data: toolDetail,
    };
  }

  @Delete(':id/supplies/:supplyDetailId')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Remover insumo de orden de trabajo',
    description: 'Remueve un insumo de la orden de trabajo',
  })
  @ApiResponse({ status: 200, description: 'Insumo removido exitosamente' })
  @ApiResponse({ status: 404, description: 'Detalle de insumo no encontrado' })
  async removeSupplyDetail(
    @Param('id', ParseIntPipe) id: number,
    @Param('supplyDetailId', ParseIntPipe) supplyDetailId: number,
  ) {
    await this.workOrdersService.removeSupplyDetail(id, supplyDetailId);
    return {
      message: 'Insumo removido exitosamente de la orden de trabajo',
    };
  }

  @Delete(':id/tool/:toolDetailId')
  @Roles('Administrador', 'Técnico')
  @ApiOperation({
    summary: 'Remover herramienta de orden de trabajo',
    description: 'Remueve una herramienta de la orden de trabajo',
  })
  @ApiResponse({
    status: 200,
    description: 'Herramienta removida exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Detalle de herramienta no encontrado',
  })
  async removeEquipmentDetail(
    @Param('id', ParseIntPipe) id: number,
    @Param('toolDetailId', ParseIntPipe) toolDetailId: number,
  ) {
    await this.workOrdersService.removeToolDetail(id, toolDetailId);
    return {
      message: 'Herramienta removida exitosamente de la orden de trabajo',
    };
  }

  @Get(':id/cost')
  @Roles('Administrador', 'Técnico', 'Secretaria', 'Supervisor')
  @ApiOperation({
    summary: 'Calcular costos de orden de trabajo',
    description: 'Calcula los costos totales de una orden de trabajo',
  })
  @ApiResponse({
    status: 200,
    description: 'Costos calculados exitosamente',
  })
  async calculateCost(@Param('id', ParseIntPipe) id: number) {
    const costs = await this.workOrdersService.calculateTotalCost(id);
    return {
      message: 'Costos calculados exitosamente',
      data: costs,
    };
  }

  private mapToResponseDto(workOrder: WorkOrder): WorkOrderResponseDto {
    const response: WorkOrderResponseDto = {
      ordenId: workOrder.ordenId,
      service: {
        servicioId: workOrder.service.servicioId,
        nombreServicio: workOrder.service.nombreServicio,
        precioBase: workOrder.service.precioBase,
        categoriaServicio: workOrder.service.categoriaServicio,
        tipoTrabajo: workOrder.service.tipoTrabajo,
        tipoMantenimiento: workOrder.service.tipoMantenimiento,
      },
      cliente: {
        usuarioId: workOrder.cliente.usuarioId,
        nombre: workOrder.cliente.nombre,
        apellido: workOrder.cliente.apellido,
        email: workOrder.cliente.email,
      },
      fechaSolicitud: workOrder.fechaSolicitud,
      fechaInicio: workOrder.fechaInicio,
      fechaFinalizacion: workOrder.fechaFinalizacion,
      estado: workOrder.estado,
      comentarios: workOrder.comentarios,
      supplyDetails: [],
      toolDetails: [],
      costoTotalInsumos: 0,
      costoTotalEstimado: 0,
    };

    if (workOrder.clienteEmpresa) {
      response.clienteEmpresa = {
        idCliente: workOrder.clienteEmpresa.idCliente,
        nombre: workOrder.clienteEmpresa.nombre,
        nit: workOrder.clienteEmpresa.nit,
        email: workOrder.clienteEmpresa.email,
        telefono: workOrder.clienteEmpresa.telefono,
        localizacion: workOrder.clienteEmpresa.localizacion,
      };
    }

    if (workOrder.tecnico) {
      response.tecnico = {
        usuarioId: workOrder.tecnico.usuarioId,
        nombre: workOrder.tecnico.nombre,
        apellido: workOrder.tecnico.apellido,
        email: workOrder.tecnico.email,
      };
    }

    if (workOrder.equipment) {
      response.equipo = {
        equipmentId: workOrder.equipment.equipmentId,
        name: workOrder.equipment.name,
        code: workOrder.equipment.code,
        category: workOrder.equipment.category,
      };
    }

    if (workOrder.supplyDetails) {
      response.supplyDetails = workOrder.supplyDetails.map((detail) => ({
        detalleInsumoId: detail.detalleInsumoId,
        cantidadUsada: detail.cantidadUsada,
        costoUnitarioAlMomento: detail.costoUnitarioAlMomento,
        nombreInsumo: detail.supply?.nombre || 'N/A',
      }));
    }

    if (workOrder.toolDetails) {
      response.toolDetails = workOrder.toolDetails.map((detail) => ({
        detalleHerramientaId: detail.detalleHerramientaId,
        tiempoUso: detail.tiempoUso,
        nombreHerramienta: detail.tool?.nombre || 'N/A',
        marca: detail.tool?.marca || 'N/A',
      }));
    }

    return response;
  }
}