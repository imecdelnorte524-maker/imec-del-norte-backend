// src/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { WorkOrderStatus } from '../work-orders/enums/work-order-status.enum';
import { BillingStatus } from '../work-orders/enums/billing-status.enum';
import { WorkOrdersService } from '../work-orders/work-orders.service';

interface DashboardFilters {
  estado?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  tecnicoId?: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    private readonly workOrdersService: WorkOrdersService,
  ) {}

  /**
   * Métricas generales para el dashboard.
   * - total
   * - completados
   * - en_proceso
   * - pendientes (sin asignar + asignadas)
   * - sin_asignar (Solicitada sin asignar)
   * - asignadas (Solicitada asignada)
   * - cancelados
   * - mis_servicios (solo para técnicos)
   * - facturadas / no_facturadas
   * - ingresos_totales (órdenes finalizadas)
   * - completadas_este_mes
   * - status_counts (para gráfica de barras, separando sin asignar / asignadas)
   * - technicians (servicios por técnico)
   */
  async getMetrics(currentUser: any): Promise<{
    total: number;
    completados: number;
    en_proceso: number;
    pendientes: number;
    sin_asignar: number;
    asignadas: number;
    cancelados: number;
    mis_servicios: number;
    facturadas: number;
    no_facturadas: number;
    ingresos_totales: number;
    completadas_este_mes: number;
    status_counts: {
      solicitada_sin_asignar: number;
      solicitada_asignada: number;
      en_proceso: number;
      completado: number;
      cancelado: number;
    };
    technicians: {
      tecnico_id: number;
      nombre: string;
      apellido: string | null;
      total_servicios: number;
      completados: number;
    }[];
  }> {
    // Usamos las estadísticas globales de WorkOrdersService,
    // que incluyen un "byStatus" agrupado por el valor real de la BD.
    const stats = await this.workOrdersService.getWorkOrderStats();

    const total = stats.total || 0;
    const byStatus: { estado: string; count: string }[] = stats.byStatus || [];

    const getCount = (estadoBD: string): number => {
      const row = byStatus.find((s) => s.estado === estadoBD);
      return row ? parseInt(row.count, 10) || 0 : 0;
    };

    // Contadores por estado real en BD
    const countSolicitadaSinAsignar = getCount(
      WorkOrderStatus.REQUESTED_UNASSIGNED,
    ); // "Solicitada sin asignar"
    const countSolicitadaAsignada = getCount(
      WorkOrderStatus.REQUESTED_ASSIGNED,
    ); // "Solicitada asignada"
    const countEnProceso = getCount(WorkOrderStatus.IN_PROGRESS); // "En proceso"
    const countFinalizada = getCount(WorkOrderStatus.COMPLETED); // "Finalizada"
    const countCancelada = getCount(WorkOrderStatus.CANCELED); // "Cancelada"

    const pendientes = countSolicitadaSinAsignar + countSolicitadaAsignada;
    const sin_asignar = countSolicitadaSinAsignar;
    const asignadas = countSolicitadaAsignada;
    const en_proceso = countEnProceso;
    const completados = countFinalizada;
    const cancelados = countCancelada;

    // mis_servicios: solo tiene sentido para técnicos (se cuenta aparte)
    const roleName = this.getRoleName(currentUser);
    let mis_servicios = 0;
    if (roleName === 'Técnico' && currentUser?.userId) {
      mis_servicios = await this.workOrderRepository.count({
        where: { tecnicoId: currentUser.userId },
      });
    }

    // Facturación
    const facturadas = await this.workOrderRepository.count({
      where: { estadoFacturacion: BillingStatus.BILLED },
    });

    const no_facturadas = await this.workOrderRepository.count({
      where: { estadoFacturacion: BillingStatus.NOT_BILLED },
    });

    // Ingresos y completadas_este_mes vienen de getWorkOrderStats()
    const ingresos_totales = stats.totalRevenue || 0;
    const completadas_este_mes = stats.completedThisMonth || 0;

    // Distribución por estado para gráfica de barras (claves explícitas)
    const status_counts = {
      solicitada_sin_asignar: countSolicitadaSinAsignar,
      solicitada_asignada: countSolicitadaAsignada,
      en_proceso: en_proceso,
      completado: completados,
      cancelado: cancelados,
    };

    // Métrica de técnicos: servicios realizados / completados por técnico
    const technicians = await this.getTechnicianStats();

    return {
      total,
      completados,
      en_proceso,
      pendientes,
      sin_asignar,
      asignadas,
      cancelados,
      mis_servicios,
      facturadas,
      no_facturadas,
      ingresos_totales,
      completadas_este_mes,
      status_counts,
      technicians,
    };
  }

  /**
   * Devuelve una lista paginada de órdenes de trabajo para el dashboard.
   * - Si se pasa tecnicoId, filtra por ese técnico (mis servicios).
   * - Aplica filtros por estado, búsqueda y rango de fechas.
   */
  async getDashboardOrders(
    filters: DashboardFilters,
  ): Promise<{
    services: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;
    const skip = (page - 1) * limit;

    const qb = this.workOrderRepository
      .createQueryBuilder('wo')
      .leftJoinAndSelect('wo.service', 'service')
      .leftJoinAndSelect('wo.cliente', 'cliente')
      .leftJoinAndSelect('wo.clienteEmpresa', 'clienteEmpresa')
      .leftJoinAndSelect('wo.tecnico', 'tecnico')
      .leftJoinAndSelect('wo.equipments', 'equipments')
      .orderBy('wo.fechaSolicitud', 'DESC');

    // Filtro por técnico (para "mis servicios")
    if (filters.tecnicoId) {
      qb.andWhere('wo.tecnicoId = :tecnicoId', {
        tecnicoId: filters.tecnicoId,
      });
    }

    // Filtro por estado (string que viene del frontend, como "Pendiente", "En Proceso", etc.)
    if (filters.estado) {
      const estados = this.mapEstadoFilterToWorkOrderStatuses(filters.estado);
      if (estados.length === 1) {
        qb.andWhere('wo.estado = :estado', { estado: estados[0] });
      } else if (estados.length > 1) {
        qb.andWhere('wo.estado IN (:...estados)', { estados });
      }
    }

    // Filtro por búsqueda (cliente empresa, cliente contacto, técnico, servicio, ID de orden)
    if (filters.search) {
      const search = `%${filters.search.toLowerCase()}%`;
      qb.andWhere(
        `
        (
          LOWER(cliente.nombre) LIKE :search OR
          LOWER(cliente.apellido) LIKE :search OR
          LOWER(clienteEmpresa.nombre) LIKE :search OR
          LOWER(service.nombreServicio) LIKE :search OR
          LOWER(tecnico.nombre) LIKE :search OR
          LOWER(tecnico.apellido) LIKE :search OR
          CAST(wo.ordenId AS TEXT) LIKE :search
        )
      `,
        { search },
      );
    }

    // Filtro por rango de fechas (usamos fechaSolicitud para simplicidad)
    if (filters.startDate) {
      qb.andWhere('DATE(wo.fechaSolicitud) >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      qb.andWhere('DATE(wo.fechaSolicitud) <= :endDate', {
        endDate: filters.endDate,
      });
    }

    qb.skip(skip).take(limit);

    const [orders, total] = await qb.getManyAndCount();

    const services = orders.map((wo) => this.mapWorkOrderToServiceFromAPI(wo));

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      services,
      total,
      page,
      limit,
      totalPages,
    };
  }

  // ---------- Helpers internos ----------

  private getRoleName(user: any): string {
    return user?.role?.nombreRol || user?.role || '';
  }

  /**
   * Métrica de técnicos: cuántos servicios ha realizado cada uno.
   * - total_servicios: recuento total de órdenes donde es técnico.
   * - completados: órdenes finalizadas.
   */
  private async getTechnicianStats(): Promise<
    {
      tecnico_id: number;
      nombre: string;
      apellido: string | null;
      total_servicios: number;
      completados: number;
    }[]
  > {
    const rows = await this.workOrderRepository
      .createQueryBuilder('wo')
      .leftJoin('wo.tecnico', 'tecnico')
      .select('tecnico.usuarioId', 'tecnico_id')
      .addSelect('tecnico.nombre', 'nombre')
      .addSelect('tecnico.apellido', 'apellido')
      .addSelect('COUNT(*)', 'total_servicios')
      .addSelect(
        `SUM(CASE WHEN wo.estado = :completed THEN 1 ELSE 0 END)`,
        'completados',
      )
      .where('wo.tecnicoId IS NOT NULL')
      .groupBy('tecnico.usuarioId')
      .addGroupBy('tecnico.nombre')
      .addGroupBy('tecnico.apellido')
      .setParameter('completed', WorkOrderStatus.COMPLETED)
      .getRawMany<{
        tecnico_id: string;
        nombre: string;
        apellido: string | null;
        total_servicios: string;
        completados: string | null;
      }>();

    return rows.map((row) => ({
      tecnico_id: parseInt(row.tecnico_id, 10),
      nombre: row.nombre,
      apellido: row.apellido,
      total_servicios: parseInt(row.total_servicios, 10) || 0,
      completados: row.completados ? parseInt(row.completados, 10) || 0 : 0,
    }));
  }

  /**
   * Mapea los estados del filtro recibido desde el frontend
   * a una o varias constantes de WorkOrderStatus.
   */
  private mapEstadoFilterToWorkOrderStatuses(
    estado: string,
  ): WorkOrderStatus[] {
    switch (estado) {
      case 'Pendiente':
        return [
          WorkOrderStatus.REQUESTED_UNASSIGNED,
          WorkOrderStatus.REQUESTED_ASSIGNED,
        ];
      case 'En Proceso':
        return [WorkOrderStatus.IN_PROGRESS];
      case 'Completado':
        return [WorkOrderStatus.COMPLETED];
      case 'Cancelado':
      case 'Cancelada':
      case 'Rechazada':
        return [WorkOrderStatus.CANCELED];
      default:
        return [];
    }
  }

  /**
   * Mapea los estados del backend (WorkOrderStatus) a los estados que
   * espera el frontend en el dashboard:
   */
  private mapEstadoWorkOrderToDashboard(estado: WorkOrderStatus): string {
    switch (estado) {
      case WorkOrderStatus.REQUESTED_UNASSIGNED:
      case WorkOrderStatus.REQUESTED_ASSIGNED:
        return 'Pendiente';
      case WorkOrderStatus.IN_PROGRESS:
        return 'En Proceso';
      case WorkOrderStatus.COMPLETED:
        return 'Completado';
      case WorkOrderStatus.CANCELED:
        return 'Cancelada';
      default:
        return 'Pendiente';
    }
  }

  /**
   * Mapea una WorkOrder al formato ServiceFromAPI que espera el frontend.
   * Aquí usamos el nombre de la EMPRESA cuando existe clienteEmpresa,
   * en lugar del contacto persona.
   */
  private mapWorkOrderToServiceFromAPI(wo: WorkOrder): any {
    const estadoDashboard = this.mapEstadoWorkOrderToDashboard(wo.estado);

    const equipoAsignado =
      wo.equipments && wo.equipments.length > 0
        ? wo.equipments[0].name
        : 'Por asignar';

    const empresa = wo.clienteEmpresa;
    const persona = wo.cliente;

    const nombreCliente = empresa?.nombre || persona?.nombre || '';
    const apellidoCliente = empresa ? null : persona?.apellido ?? null;
    const emailCliente = empresa?.email || persona?.email || '';
    const telefonoCliente = empresa?.telefono || persona?.telefono || null;

    return {
      orden_id: wo.ordenId,
      servicio_id: wo.servicioId,
      cliente_id: empresa
        ? empresa.idCliente
        : persona?.usuarioId ?? wo.clienteId,
      tecnico_id: wo.tecnicoId ?? null,
      fecha_solicitud: wo.fechaSolicitud.toISOString(),
      fecha_inicio: wo.fechaInicio ? wo.fechaInicio.toISOString() : null,
      fecha_finalizacion: wo.fechaFinalizacion
        ? wo.fechaFinalizacion.toISOString()
        : null,
      estado: estadoDashboard,
      comentarios: wo.comentarios ?? null,
      servicio: {
        servicio_id: wo.service?.servicioId ?? wo.servicioId,
        nombre_servicio: wo.service?.nombreServicio ?? '',
        descripcion: wo.service?.descripcion ?? null,
        precio_base: wo.service?.precioBase ?? 0,
        duracion_estimada: wo.service?.duracionEstimada ?? null,
      },
      cliente: {
        usuario_id: empresa
          ? empresa.idCliente
          : persona?.usuarioId ?? wo.clienteId,
        nombre: nombreCliente,
        apellido: apellidoCliente,
        email: emailCliente,
        telefono: telefonoCliente,
      },
      tecnico: wo.tecnico
        ? {
            usuario_id: wo.tecnico.usuarioId,
            nombre: wo.tecnico.nombre,
            apellido: wo.tecnico.apellido ?? null,
            email: wo.tecnico.email,
          }
        : null,
      prioridad: 'Media',
      equipo_asignado: equipoAsignado,
    };
  }
}