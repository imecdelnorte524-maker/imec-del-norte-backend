// src/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { WorkOrderStatus } from '../shared/index';
import { BillingStatus } from '../shared/index';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { User } from '../users/entities/user.entity';

interface DashboardFilters {
  estado?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  tecnicoId?: number;
  clienteId?: number;
  clienteEmpresaId?: number;
}

interface MyServicesFilters extends Omit<
  DashboardFilters,
  'tecnicoId' | 'clienteId' | 'clienteEmpresaId'
> {
  userRole: string;
  userId: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly workOrdersService: WorkOrdersService,
  ) {}

  /**
   * Obtiene las empresas asociadas a un usuario cliente
   */
  private async getClientEmpresasIds(userId: number): Promise<number[]> {
    try {
      // Usar QUERY DIRECTO a la tabla intermedia
      const rawResult = await this.userRepository
        .createQueryBuilder('user')
        .innerJoin(
          'clientes_usuarios_contacto',
          'cuc',
          'cuc.id_usuario = user.usuarioId',
        )
        .where('user.usuarioId = :userId', { userId })
        .select('cuc.id_cliente', 'id')
        .getRawMany();

      const empresaIds = rawResult
        .map((r) => r.id)
        .filter((id) => id !== null && id !== undefined);
      return empresaIds;
    } catch (error) {
      console.error(
        `❌ Error obteniendo empresas del usuario ${userId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Métricas generales para el dashboard con filtros por rol.
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
    const roleName = currentUser?.role?.nombreRol || currentUser?.role || '';
    const userId = currentUser?.userId;

    let empresaIds: number[] = [];

    // Para cliente, obtener las empresas que representa
    if (roleName === 'Cliente' && userId) {
      empresaIds = await this.getClientEmpresasIds(userId);
    }

    // Construir query base para contar por estado
    const buildStatusCountQuery = (estado?: WorkOrderStatus) => {
      const qb = this.workOrderRepository.createQueryBuilder('wo');

      // Aplicar filtros por rol
      if (roleName === 'Técnico' && userId) {
        qb.innerJoin('wo.technicians', 'tech_filter').andWhere(
          'tech_filter.tecnicoId = :userId',
          { userId },
        );
      } else if (roleName === 'Cliente' && userId) {
        if (empresaIds.length > 0) {
          qb.andWhere('wo.clienteEmpresaId IN (:...empresaIds)', {
            empresaIds,
          });
        } else {
          qb.andWhere('1 = 0'); // No devuelve nada si no tiene empresas
        }
      }

      if (estado) {
        qb.andWhere('wo.estado = :estado', { estado });
      }

      return qb;
    };

    // Contar por estado con los filtros aplicados
    const countByStatus = async (estado: WorkOrderStatus): Promise<number> => {
      return buildStatusCountQuery(estado).getCount();
    };

    // Obtener conteos
    const countSolicitadaSinAsignar = await countByStatus(
      WorkOrderStatus.REQUESTED_UNASSIGNED,
    );
    const countSolicitadaAsignada = await countByStatus(
      WorkOrderStatus.REQUESTED_ASSIGNED,
    );
    const countEnProceso = await countByStatus(WorkOrderStatus.IN_PROGRESS);
    const countFinalizada = await countByStatus(WorkOrderStatus.COMPLETED);
    const countCancelada = await countByStatus(WorkOrderStatus.CANCELED);
    const countPausada = await countByStatus(WorkOrderStatus.PAUSED);

    const pendientes = countSolicitadaSinAsignar + countSolicitadaAsignada;
    const sin_asignar = countSolicitadaSinAsignar;
    const asignadas = countSolicitadaAsignada;
    const en_proceso = countEnProceso;
    const completados = countFinalizada;
    const cancelados = countCancelada;
    const pausados = countPausada;

    // Total general con filtros
    const total = await buildStatusCountQuery().getCount();

    // Mis servicios (ya filtrado por rol)
    let mis_servicios = 0;

    if (userId) {
      if (roleName === 'Técnico') {
        mis_servicios = await this.workOrderRepository
          .createQueryBuilder('wo')
          .innerJoin('wo.technicians', 'technician')
          .where('technician.tecnicoId = :userId', { userId })
          .getCount();
      } else if (roleName === 'Cliente') {
        if (empresaIds.length > 0) {
          mis_servicios = await this.workOrderRepository
            .createQueryBuilder('wo')
            .where('wo.clienteEmpresaId IN (:...empresaIds)', { empresaIds })
            .getCount();
        } else {
          mis_servicios = 0;
        }
      } else {
        mis_servicios = total;
      }
    }

    // Facturadas/No facturadas con filtros
    const buildBillingQuery = (estadoFacturacion?: BillingStatus) => {
      const qb = this.workOrderRepository.createQueryBuilder('wo');

      if (roleName === 'Técnico' && userId) {
        qb.innerJoin('wo.technicians', 'tech_filter').andWhere(
          'tech_filter.tecnicoId = :userId',
          { userId },
        );
      } else if (roleName === 'Cliente' && userId) {
        if (empresaIds.length > 0) {
          qb.andWhere('wo.clienteEmpresaId IN (:...empresaIds)', {
            empresaIds,
          });
        } else {
          qb.andWhere('1 = 0');
        }
      }

      if (estadoFacturacion) {
        qb.andWhere('wo.estadoFacturacion = :estadoFacturacion', {
          estadoFacturacion,
        });
      }

      return qb;
    };

    const facturadas = await buildBillingQuery(BillingStatus.BILLED).getCount();
    const no_facturadas = await buildBillingQuery(
      BillingStatus.NOT_BILLED,
    ).getCount();

    // Ingresos totales y completadas este mes
    let ingresos_totales = 0;
    let completadas_este_mes = 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    if (['Administrador', 'Supervisor', 'Secretaria'].includes(roleName)) {
      const stats = await this.workOrdersService.getWorkOrderStats();
      ingresos_totales = stats.totalRevenue || 0;
      completadas_este_mes = stats.completedThisMonth || 0;
    } else if (roleName === 'Técnico' && userId) {
      const qbCompletadas = this.workOrderRepository
        .createQueryBuilder('wo')
        .innerJoin('wo.technicians', 'tech_filter')
        .where('tech_filter.tecnicoId = :userId', { userId })
        .andWhere('wo.estado = :estado', { estado: WorkOrderStatus.COMPLETED });

      completadas_este_mes = await qbCompletadas
        .andWhere('wo.fechaFinalizacion BETWEEN :start AND :end', {
          start: startOfMonth,
          end: endOfMonth,
        })
        .getCount();

      const ordersWithCosts = await qbCompletadas
        .leftJoinAndSelect('wo.supplyDetails', 'supplyDetails')
        .getMany();

      ingresos_totales = ordersWithCosts.reduce((sum, order) => {
        const costInsumos =
          order.supplyDetails?.reduce(
            (s, det) =>
              s + det.cantidadUsada * (det.costoUnitarioAlMomento || 0),
            0,
          ) || 0;
        return sum + costInsumos;
      }, 0);
    } else if (roleName === 'Cliente' && userId && empresaIds.length > 0) {
      const qbCompletadas = this.workOrderRepository
        .createQueryBuilder('wo')
        .where('wo.clienteEmpresaId IN (:...empresaIds)', { empresaIds })
        .andWhere('wo.estado = :estado', { estado: WorkOrderStatus.COMPLETED });

      completadas_este_mes = await qbCompletadas
        .andWhere('wo.fechaFinalizacion BETWEEN :start AND :end', {
          start: startOfMonth,
          end: endOfMonth,
        })
        .getCount();
    }

    const status_counts = {
      solicitada_sin_asignar: countSolicitadaSinAsignar,
      solicitada_asignada: countSolicitadaAsignada,
      en_proceso: en_proceso,
      completado: completados,
      cancelado: cancelados,
      pausado: pausados,
    };

    // Técnicos stats (solo para admin/supervisor/secretaria)
    let technicians: any[] = [];
    if (['Administrador', 'Supervisor', 'Secretaria'].includes(roleName)) {
      technicians = await this.getTechnicianStats();
    }

    const result = {
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
    return result;
  }

  /**
   * Devuelve una lista paginada de órdenes de trabajo para el dashboard.
   */
  async getDashboardOrders(
    filters: DashboardFilters,
    currentUser?: any,
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
      .leftJoinAndSelect('wo.technicians', 'technicians')
      .leftJoinAndSelect('technicians.technician', 'tecnico')
      .leftJoinAndSelect('wo.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .orderBy('wo.fechaSolicitud', 'DESC');

    // Aplicar filtros por rol si se proporciona currentUser
    if (currentUser) {
      const roleName = currentUser?.role?.nombreRol || currentUser?.role || '';
      const userId = currentUser?.userId;

      if (roleName === 'Técnico' && userId) {
        qb.innerJoin('wo.technicians', 'role_tech_filter').andWhere(
          'role_tech_filter.tecnicoId = :userId',
          { userId },
        );
      } else if (roleName === 'Cliente' && userId) {
        const empresaIds = await this.getClientEmpresasIds(userId);
        if (empresaIds.length > 0) {
          qb.andWhere('wo.clienteEmpresaId IN (:...empresaIds)', {
            empresaIds,
          });
        } else {
          qb.andWhere('1 = 0');
        }
      }
    }

    // Aplicar filtros adicionales
    if (filters.tecnicoId) {
      qb.andWhere('technicians.tecnicoId = :tecnicoId', {
        tecnicoId: filters.tecnicoId,
      });
    }

    if (filters.clienteId) {
      qb.andWhere(
        '(wo.clienteId = :clienteId OR wo.clienteEmpresaId = :clienteId)',
        { clienteId: filters.clienteId },
      );
    }

    if (filters.clienteEmpresaId) {
      qb.andWhere('wo.clienteEmpresaId = :clienteEmpresaId', {
        clienteEmpresaId: filters.clienteEmpresaId,
      });
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
        `(
          LOWER(cliente.nombre) LIKE :search OR
          LOWER(cliente.apellido) LIKE :search OR
          LOWER(clienteEmpresa.nombre) LIKE :search OR
          LOWER(service.nombreServicio) LIKE :search OR
          LOWER(tecnico.nombre) LIKE :search OR
          LOWER(tecnico.apellido) LIKE :search OR
          CAST(wo.ordenId AS TEXT) LIKE :search OR
          LOWER(equipment.code) LIKE :search
        )`,
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

    return { services, total, page, limit, totalPages };
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

    const dashboardFilters: DashboardFilters = {
      estado: filters.estado,
      search: filters.search,
      startDate: filters.startDate,
      endDate: filters.endDate,
      page: filters.page,
      limit: filters.limit,
    };

    const mockCurrentUser = { userId, role: { nombreRol: userRole } };

    if (userRole === 'Técnico') {
      dashboardFilters.tecnicoId = userId;
    } else if (userRole === 'Cliente') {
      dashboardFilters.clienteId = userId;
    }

    return this.getDashboardOrders(dashboardFilters, mockCurrentUser);
  }

  // ---------- Helpers internos ----------

  private getRoleName(user: any): string {
    return user?.role?.nombreRol || user?.role || '';
  }

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
      .innerJoin('wo.technicians', 'technicians')
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
      .getRawMany();

    return rows.map((row) => ({
      tecnico_id: parseInt(row.tecnico_id, 10),
      nombre: row.nombre,
      apellido: row.apellido,
      total_servicios: parseInt(row.total_servicios, 10) || 0,
      completados: row.completados ? parseInt(row.completados, 10) || 0 : 0,
    }));
  }

  private mapEstadoFilterToWorkOrderStatuses(
    estado: string,
  ): WorkOrderStatus[] {
    switch (estado) {
      case 'Pendiente':
        return [WorkOrderStatus.REQUESTED_UNASSIGNED];
      case 'Solicitada asignada':
        return [WorkOrderStatus.REQUESTED_ASSIGNED];
      case 'En Proceso':
        return [WorkOrderStatus.IN_PROGRESS];
      case 'Completado':
      case 'Finalizada':
        return [WorkOrderStatus.COMPLETED];
      case 'Cancelado':
      case 'Cancelada':
      case 'Rechazada':
        return [WorkOrderStatus.CANCELED];
      case 'En pausa':
      case 'Pausada':
        return [WorkOrderStatus.PAUSED];
      default:
        return [];
    }
  }

  private mapEstadoWorkOrderToDashboard(estado: WorkOrderStatus): string {
    switch (estado) {
      case WorkOrderStatus.REQUESTED_UNASSIGNED:
        return 'Pendiente';
      case WorkOrderStatus.REQUESTED_ASSIGNED:
        return 'Solicitada asignada';
      case WorkOrderStatus.IN_PROGRESS:
        return 'En Proceso';
      case WorkOrderStatus.COMPLETED:
        return 'Completado';
      case WorkOrderStatus.CANCELED:
        return 'Cancelada';
      case WorkOrderStatus.PAUSED:
        return 'En pausa';
      default:
        return 'Pendiente';
    }
  }

  private mapWorkOrderToServiceFromAPI(wo: WorkOrder): any {
    const estadoDashboard = this.mapEstadoWorkOrderToDashboard(wo.estado);
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

    const equiposAsociados =
      wo.equipmentWorkOrders?.map((ewo) => ({
        equipmentId: ewo.equipment.equipmentId,
        code: ewo.equipment.code,
        category: ewo.equipment.category,
        description: ewo.description || ewo.equipment.notes || null,
        status: ewo.equipment.status,
      })) || [];

    const primerTecnico = wo.technicians?.[0]?.technician;
    const tecnicoId = primerTecnico?.usuarioId ?? null;

    return {
      orden_id: wo.ordenId,
      servicio_id: wo.servicioId,
      cliente_id: empresa
        ? empresa.idCliente
        : (persona?.usuarioId ?? wo.clienteId),
      tecnico_id: tecnicoId,
      fecha_solicitud: wo.fechaSolicitud.toISOString(),
      fecha_inicio: wo.fechaInicio ? wo.fechaInicio.toISOString() : null,
      fecha_finalizacion: wo.fechaFinalizacion
        ? wo.fechaFinalizacion.toISOString()
        : null,
      estado: estadoDashboard,
      comentarios: wo.comentarios ?? null,
      tipo_servicio: wo.tipoServicio || null,
      maintenance_type: wo.maintenanceType
        ? { id: wo.maintenanceType.id, nombre: wo.maintenanceType.nombre }
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
