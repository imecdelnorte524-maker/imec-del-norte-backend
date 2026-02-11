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
  clienteId?: number;
}

interface MyServicesFilters extends Omit<
  DashboardFilters,
  'tecnicoId' | 'clienteId'
> {
  userRole: string;
  userId: number;
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
    pausados: number;
    status_counts: {
      solicitada_sin_asignar: number;
      solicitada_asignada: number;
      en_proceso: number;
      completado: number;
      cancelado: number;
      pausado: number;
    };
    technicians: {
      tecnico_id: number;
      nombre: string;
      apellido: string | null;
      total_servicios: number;
      completados: number;
    }[];
  }> {
    const stats = await this.workOrdersService.getWorkOrderStats();

    const total = stats.total || 0;
    const byStatus: { estado: string; count: string }[] = stats.byStatus || [];

    const getCount = (estadoBD: string): number => {
      const row = byStatus.find((s) => s.estado === estadoBD);
      return row ? parseInt(row.count, 10) || 0 : 0;
    };

    const countSolicitadaSinAsignar = getCount(
      WorkOrderStatus.REQUESTED_UNASSIGNED,
    );
    const countSolicitadaAsignada = getCount(
      WorkOrderStatus.REQUESTED_ASSIGNED,
    );
    const countEnProceso = getCount(WorkOrderStatus.IN_PROGRESS);
    const countFinalizada = getCount(WorkOrderStatus.COMPLETED);
    const countCancelada = getCount(WorkOrderStatus.CANCELED);
    const countPausada = getCount(WorkOrderStatus.PAUSED);

    const pendientes = countSolicitadaSinAsignar + countSolicitadaAsignada;
    const sin_asignar = countSolicitadaSinAsignar;
    const asignadas = countSolicitadaAsignada;
    const en_proceso = countEnProceso;
    const completados = countFinalizada;
    const cancelados = countCancelada;
    const pausados = countPausada;

    let mis_servicios = 0;
    const roleName = this.getRoleName(currentUser);
    const userId = currentUser?.userId;

    if (userId) {
      if (roleName === 'Técnico') {
        // Contar órdenes donde el usuario es uno de los técnicos asignados
        mis_servicios = await this.workOrderRepository
          .createQueryBuilder('wo')
          .innerJoin('wo.technicians', 'technician')
          .where('technician.tecnicoId = :userId', { userId })
          .getCount();
      } else if (roleName === 'Cliente') {
        mis_servicios = await this.workOrderRepository
          .createQueryBuilder('wo')
          .where('(wo.clienteId = :userId OR wo.clienteEmpresaId = :userId)', {
            userId,
          })
          .getCount();
      }
    }

    const facturadas = await this.workOrderRepository.count({
      where: { estadoFacturacion: BillingStatus.BILLED },
    });

    const no_facturadas = await this.workOrderRepository.count({
      where: { estadoFacturacion: BillingStatus.NOT_BILLED },
    });

    const ingresos_totales = stats.totalRevenue || 0;
    const completadas_este_mes = stats.completedThisMonth || 0;

    const status_counts = {
      solicitada_sin_asignar: countSolicitadaSinAsignar,
      solicitada_asignada: countSolicitadaAsignada,
      en_proceso: en_proceso,
      completado: completados,
      cancelado: cancelados,
      pausado: pausados,
    };

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
      pausados,
    };
  }

  /**
   * Devuelve una lista paginada de órdenes de trabajo para el dashboard.
   */
  async getDashboardOrders(filters: DashboardFilters): Promise<{
    services: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;
    const skip = (page - 1) * limit;

    // ✅ CONSULTA CORREGIDA: Usar equipmentWorkOrders y cargar equipment
    const qb = this.workOrderRepository
      .createQueryBuilder('wo')
      .leftJoinAndSelect('wo.service', 'service')
      .leftJoinAndSelect('wo.cliente', 'cliente')
      .leftJoinAndSelect('wo.clienteEmpresa', 'clienteEmpresa')
      .leftJoinAndSelect('wo.technicians', 'technicians')
      .leftJoinAndSelect('technicians.technician', 'tecnico')
      .leftJoinAndSelect('wo.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .orderBy('wo.fechaSolicitud', 'DESC');

    if (filters.tecnicoId) {
      qb.andWhere('technicians.tecnicoId = :tecnicoId', {
        tecnicoId: filters.tecnicoId,
      });
    }

    if (filters.clienteId) {
      qb.andWhere(
        '(wo.clienteId = :clienteId OR wo.clienteEmpresaId = :clienteId)',
        {
          clienteId: filters.clienteId,
        },
      );
    }

    if (filters.estado) {
      const estados = this.mapEstadoFilterToWorkOrderStatuses(filters.estado);
      if (estados.length === 1) {
        qb.andWhere('wo.estado = :estado', { estado: estados[0] });
      } else if (estados.length > 1) {
        qb.andWhere('wo.estado IN (:...estados)', { estados });
      }
    }

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
          CAST(wo.ordenId AS TEXT) LIKE :search OR
          LOWER(equipment.code) LIKE :search
        )
      `,
        { search },
      );
    }

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

  /**
   * Obtiene las órdenes de servicio del usuario actual según su rol.
   */
  async getMyServices(filters: MyServicesFilters): Promise<{
    services: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { userRole, userId } = filters;

    if (!userId) {
      return {
        services: [],
        total: 0,
        page: filters.page || 1,
        limit: filters.limit || 20,
        totalPages: 0,
      };
    }

    let dashboardFilters: DashboardFilters = {
      estado: filters.estado,
      search: filters.search,
      startDate: filters.startDate,
      endDate: filters.endDate,
      page: filters.page,
      limit: filters.limit,
    };

    if (userRole === 'Técnico') {
      dashboardFilters.tecnicoId = userId;
    } else if (userRole === 'Cliente') {
      dashboardFilters.clienteId = userId;
    } else {
      return {
        services: [],
        total: 0,
        page: filters.page || 1,
        limit: filters.limit || 20,
        totalPages: 0,
      };
    }

    return this.getDashboardOrders(dashboardFilters);
  }

  // ---------- Helpers internos ----------

  private getRoleName(user: any): string {
    return user?.role?.nombreRol || user?.role || '';
  }

  /**
   * Métrica de técnicos: cuántos servicios ha realizado cada uno.
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
      .innerJoin('wo.technicians', 'technicians') // ← CAMBIA: wo.technicians
      .innerJoin('technicians.technician', 'tecnico')
      .select('tecnico.usuarioId', 'tecnico_id')
      .addSelect('tecnico.nombre', 'nombre')
      .addSelect('tecnico.apellido', 'apellido')
      .addSelect('COUNT(DISTINCT wo.ordenId)', 'total_servicios')
      .addSelect(
        `SUM(CASE WHEN wo.estado = :completed THEN 1 ELSE 0 END)`,
        'completados',
      )
      .where('technicians.tecnicoId IS NOT NULL')
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
   * Mapea los estados del filtro recibido desde el frontend.
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
   * Mapea los estados del backend a los estados del frontend.
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
   * Mapea una WorkOrder al formato que espera el frontend.
   * ✅ CORREGIDO: Acceder a equipmentWorkOrders[0].equipment
   */
  private mapWorkOrderToServiceFromAPI(wo: WorkOrder): any {
    const estadoDashboard = this.mapEstadoWorkOrderToDashboard(wo.estado);

    // Acceder al equipo a través de la tabla intermedia
    const primerEquipo = wo.equipmentWorkOrders?.[0]?.equipment;
    const equipoAsignado = primerEquipo
      ? primerEquipo.code || `Equipo #${primerEquipo.equipmentId}`
      : 'Por asignar';

    const empresa = wo.clienteEmpresa;
    const persona = wo.cliente;

    const nombreCliente = empresa?.nombre || persona?.nombre || '';
    const apellidoCliente = empresa ? null : (persona?.apellido ?? null);
    const emailCliente = empresa?.email || persona?.email || '';
    const telefonoCliente = empresa?.telefono || persona?.telefono || null;

    // ARRAY DE EQUIPOS ASOCIADOS
    const equiposAsociados =
      wo.equipmentWorkOrders?.map((ewo) => ({
        equipmentId: ewo.equipment.equipmentId,
        code: ewo.equipment.code,
        category: ewo.equipment.category,
        description: ewo.description || ewo.equipment.notes || null,
        status: ewo.equipment.status,
      })) || [];

    // Obtener técnicos asignados (usar el primer técnico como principal para compatibilidad)
    const primerTecnico = wo.technicians?.[0]?.technician;
    const tecnicoId = primerTecnico?.usuarioId ?? null;

    return {
      orden_id: wo.ordenId,
      servicio_id: wo.servicioId,
      cliente_id: empresa
        ? empresa.idCliente
        : (persona?.usuarioId ?? wo.clienteId),
      tecnico_id: tecnicoId, // Usar el primer técnico
      fecha_solicitud: wo.fechaSolicitud.toISOString(),
      fecha_inicio: wo.fechaInicio ? wo.fechaInicio.toISOString() : null,
      fecha_finalizacion: wo.fechaFinalizacion
        ? wo.fechaFinalizacion.toISOString()
        : null,
      estado: estadoDashboard,
      comentarios: wo.comentarios ?? null,
      tipo_servicio: wo.tipoServicio || null,
      maintenance_type: wo.maintenanceType
        ? {
            id: wo.maintenanceType.id,
            nombre: wo.maintenanceType.nombre,
          }
        : null,
      estado_facturacion:
        wo.estadoFacturacion === BillingStatus.BILLED
          ? 'Facturado'
          : 'Por facturar',
      factura_pdf_url: wo.facturaPdfUrl || null,
      servicio: {
        servicio_id: wo.service?.servicioId ?? wo.servicioId,
        nombre_servicio: wo.service?.nombreServicio ?? '',
        descripcion: wo.service?.descripcion ?? null,
        duracion_estimada: wo.service?.duracionEstimada ?? null,
        categoria_servicio: wo.service?.categoriaServicio ?? null,
      },
      cliente: {
        usuario_id: empresa
          ? empresa.idCliente
          : (persona?.usuarioId ?? wo.clienteId),
        nombre: nombreCliente,
        apellido: apellidoCliente,
        email: emailCliente,
        telefono: telefonoCliente,
      },
      cliente_empresa: empresa
        ? {
            id_cliente: empresa.idCliente,
            nombre: empresa.nombre,
            nit: empresa.nit,
            email: empresa.email,
            telefono: empresa.telefono,
            localizacion: empresa.localizacion,
            direccion: empresa.direccionCompleta || null,
            contacto: empresa.contacto || null,
          }
        : null,
      tecnico: primerTecnico
        ? {
            usuario_id: primerTecnico.usuarioId,
            nombre: primerTecnico.nombre,
            apellido: primerTecnico.apellido ?? null,
            email: primerTecnico.email,
          }
        : null,
      tecnicos:
        wo.technicians?.map((tech) => ({
          id: tech.id,
          tecnicoId: tech.tecnicoId,
          isLeader: tech.isLeader,
          technician: {
            usuario_id: tech.technician?.usuarioId,
            nombre: tech.technician?.nombre,
            apellido: tech.technician?.apellido,
            email: tech.technician?.email,
          },
        })) || [],
      prioridad: 'Media',
      equipo_asignado: equipoAsignado,
      equipos: equiposAsociados,
      supplyDetails:
        wo.supplyDetails?.map((det) => ({
          detalleInsumoId: det.detalleInsumoId,
          cantidadUsada: det.cantidadUsada,
          costoUnitarioAlMomento: det.costoUnitarioAlMomento,
          nombreInsumo: det.supply?.nombre || '',
        })) || [],
      toolDetails:
        wo.toolDetails?.map((det) => ({
          detalleHerramientaId: det.detalleHerramientaId,
          tiempoUso: det.tiempoUso,
          nombreHerramienta: det.tool?.nombre || '',
          marca: det.tool?.marca || '',
        })) || [],
      costo_total_insumos:
        wo.supplyDetails?.reduce(
          (sum, det) =>
            sum + det.cantidadUsada * (det.costoUnitarioAlMomento || 0),
          0,
        ) || 0,
    };
  }
}
