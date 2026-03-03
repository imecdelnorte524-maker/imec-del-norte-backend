// src/technicians/technician-ranking.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WorkOrderTechnician } from '../work-orders/entities/work-order-technician.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { User } from '../users/entities/user.entity';
import { WorkOrderStatus } from '../shared/index';
import { RANKING_METRICS } from '../shared/index';
import { TechnicianRankingHistory } from './entities/technician-ranking-history.entity';

export interface TechnicianRankingData {
  tecnicoId: number;
  nombre: string;
  apellido?: string | null;
  metrics: {
    calificacionPromedio: number;
    totalOrdenes: number;
    puntualidad: number;
    esLider: number;
  };
  puntajeTotal: number;
  puesto: number;
  tendencia: 'up' | 'down' | 'stable';
  variacionPuesto: number;
}

export interface MonthlyRanking {
  mes: number;
  año: number;
  fechaCalculo: Date;
  ranking: TechnicianRankingData[];
  totalTecnicos: number;
}

export interface TechnicianEvolution {
  tecnicoId: number;
  nombre: string;
  apellido?: string | null;
  historial: Array<{
    mes: number;
    año: number;
    puesto: number;
    puntajeTotal: number;
    calificacionPromedio: number;
    totalOrdenes: number;
  }>;
}

export interface RankingStats {
  totalTecnicosActivos: number;
  promedioGeneral: number;
  mejorCalificacionMes: number;
  tecnicoDelMes: {
    tecnicoId: number;
    nombre: string;
    apellido?: string | null;
    puntajeTotal: number;
  } | null;
  ordenesPromedioPorTecnico: number;
}

@Injectable()
export class TechnicianRankingService {
  private readonly logger = new Logger(TechnicianRankingService.name);

  constructor(
    @InjectRepository(WorkOrderTechnician)
    private workOrderTechnicianRepository: Repository<WorkOrderTechnician>,
    @InjectRepository(WorkOrder)
    private workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(TechnicianRankingHistory)
    private rankingHistoryRepository: Repository<TechnicianRankingHistory>,
  ) {}

  /**
   * Calcula el ranking de técnicos para un mes específico
   * @param currentUser - Usuario actual (opcional, para filtrar por técnico)
   */
  async calculateMonthlyRanking(
    mes: number,
    año: number,
    currentUser?: any,
    saveToHistory: boolean = true,
  ): Promise<MonthlyRanking> {

    // Definir rango de fechas del mes
    const startDate = new Date(año, mes - 1, 1);
    const endDate = new Date(año, mes, 0, 23, 59, 59);

    const roleName = currentUser?.role?.nombreRol || currentUser?.role || '';
    const userId = currentUser?.userId;

    let tecnicos: User[] = [];

    // Si es técnico, solo obtener su propio usuario
    if (roleName === 'Técnico' && userId) {
      const tecnico = await this.userRepository.findOne({
        where: { usuarioId: userId, activo: true },
        relations: ['role'],
      });

      if (tecnico) {
        tecnicos = [tecnico];
      }
    } else {
      // Para admin/supervisor/secretaria, obtener todos los técnicos activos
      tecnicos = await this.userRepository
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol = :rol', { rol: 'Técnico' })
        .andWhere('user.activo = :activo', { activo: true })
        .select(['user.usuarioId', 'user.nombre', 'user.apellido'])
        .getMany();
    }

    const rankingData: TechnicianRankingData[] = [];

    for (const tecnico of tecnicos) {
      // Obtener métricas del técnico en el mes
      const metrics = await this.calculateTechnicianMetrics(
        tecnico.usuarioId,
        startDate,
        endDate,
      );

      // Solo incluir si cumple con el mínimo de órdenes
      if (metrics.totalOrdenes >= RANKING_METRICS.MIN_ORDENES_REQUERIDAS) {
        const puntajeTotal = this.calculateTotalScore(metrics);

        rankingData.push({
          tecnicoId: tecnico.usuarioId,
          nombre: tecnico.nombre,
          apellido: tecnico.apellido,
          metrics,
          puntajeTotal,
          puesto: 0,
          tendencia: 'stable',
          variacionPuesto: 0,
        });
      }
    }

    // Ordenar por puntaje total (mayor a menor)
    rankingData.sort((a, b) => b.puntajeTotal - a.puntajeTotal);

    // Asignar puestos
    rankingData.forEach((item, index) => {
      item.puesto = index + 1;
    });

    // Calcular tendencias comparando con mes anterior (solo para admin/supervisor/secretaria)
    if (roleName !== 'Técnico') {
      await this.calculateTendencies(rankingData, mes, año);
    }

    // Guardar en historial si se solicita (solo para admin/supervisor/secretaria)
    if (saveToHistory && rankingData.length > 0 && roleName !== 'Técnico') {
      await this.saveRankingHistory(rankingData, mes, año);
    }

    return {
      mes,
      año,
      fechaCalculo: new Date(),
      ranking: rankingData.slice(0, 10),
      totalTecnicos: rankingData.length,
    };
  }

  /**
   * Calcula las métricas individuales de un técnico
   */
  private async calculateTechnicianMetrics(
    tecnicoId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    calificacionPromedio: number;
    totalOrdenes: number;
    puntualidad: number;
    esLider: number;
  }> {
    // Obtener todas las órdenes del técnico en el período
    const ordenesTecnico = await this.workOrderTechnicianRepository
      .createQueryBuilder('wot')
      .innerJoin('wot.workOrder', 'wo')
      .where('wot.tecnicoId = :tecnicoId', { tecnicoId })
      .andWhere('wo.fechaFinalizacion BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('wo.estado = :estado', { estado: WorkOrderStatus.COMPLETED })
      .select([
        'wot.id',
        'wot.rating',
        'wot.isLeader',
        'wo.fechaProgramada',
        'wo.fechaFinalizacion',
      ])
      .getMany();

    // Filtrar solo las que tienen calificación
    const ordenesCalificadas = ordenesTecnico.filter(
      (ot) => ot.rating !== null && ot.rating !== undefined,
    );

    // 1. Calificación promedio
    const calificacionPromedio =
      ordenesCalificadas.length > 0
        ? ordenesCalificadas.reduce((sum, ot) => {
            const rating =
              typeof ot.rating === 'string'
                ? parseFloat(ot.rating)
                : Number(ot.rating);
            return sum + rating;
          }, 0) / ordenesCalificadas.length
        : 0;

    // 2. Total de órdenes completadas
    const totalOrdenes = ordenesTecnico.length;

    // 3. Puntualidad (basado en fechas programadas vs reales)
    const puntualidad = await this.calculatePuntualidad(ordenesTecnico);

    // 4. Bonus por ser líder (cantidad de veces que fue líder)
    const esLider = ordenesTecnico.filter((ot) => ot.isLeader === true).length;

    return {
      calificacionPromedio,
      totalOrdenes,
      puntualidad,
      esLider,
    };
  }

  /**
   * Calcula el puntaje de puntualidad (0-5)
   */
  private async calculatePuntualidad(ordenes: any[]): Promise<number> {
    const ordenesConProgramacion = ordenes.filter(
      (o) => o.workOrder?.fechaProgramada && o.workOrder?.fechaFinalizacion,
    );

    if (ordenesConProgramacion.length === 0) return 5;

    let sumaPuntualidad = 0;

    for (const orden of ordenesConProgramacion) {
      const fechaProg = new Date(orden.workOrder.fechaProgramada);
      const fechaFin = new Date(orden.workOrder.fechaFinalizacion);

      const diffDias = Math.ceil(
        Math.abs(fechaFin.getTime() - fechaProg.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (diffDias <= 1) sumaPuntualidad += 5;
      else if (diffDias <= 3) sumaPuntualidad += 4;
      else if (diffDias <= 5) sumaPuntualidad += 3;
      else if (diffDias <= 7) sumaPuntualidad += 2;
      else sumaPuntualidad += 1;
    }

    return sumaPuntualidad / ordenesConProgramacion.length;
  }

  /**
   * Calcula el puntaje total ponderado
   */
  private calculateTotalScore(metrics: {
    calificacionPromedio: number;
    totalOrdenes: number;
    puntualidad: number;
    esLider: number;
  }): number {
    const { WEIGHTS } = RANKING_METRICS;

    const ordenesNormalizadas = Math.min(metrics.totalOrdenes / 4, 5);
    const liderazgoNormalizado = Math.min(metrics.esLider * 0.5, 5);

    const puntaje =
      metrics.calificacionPromedio * WEIGHTS.CALIFICACION_PROMEDIO +
      ordenesNormalizadas * WEIGHTS.ORDENES_COMPLETADAS +
      metrics.puntualidad * WEIGHTS.PUNTUALIDAD +
      liderazgoNormalizado * 0.1;

    return Number(puntaje.toFixed(2));
  }

  /**
   * Calcula la tendencia comparando con el mes anterior
   */
  private async calculateTendencies(
    rankingActual: TechnicianRankingData[],
    mes: number,
    año: number,
  ): Promise<void> {
    let mesAnterior = mes - 1;
    let añoAnterior = año;

    if (mesAnterior === 0) {
      mesAnterior = 12;
      añoAnterior = año - 1;
    }

    try {
      const rankingAnterior = await this.getStoredRanking(
        mesAnterior,
        añoAnterior,
      );

      if (rankingAnterior) {
        const rankingAnteriorMap = new Map(
          rankingAnterior.map((item) => [item.tecnicoId, item]),
        );

        for (const tecnico of rankingActual) {
          const anterior = rankingAnteriorMap.get(tecnico.tecnicoId);

          if (anterior) {
            const diff = anterior.puesto - tecnico.puesto;
            tecnico.variacionPuesto = diff;

            if (diff > 0) tecnico.tendencia = 'up';
            else if (diff < 0) tecnico.tendencia = 'down';
            else tecnico.tendencia = 'stable';
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `No hay ranking anterior disponible para ${mesAnterior}/${añoAnterior}`,
      );
    }
  }

  /**
   * Guarda el ranking calculado en la base de datos (historial)
   */
  private async saveRankingHistory(
    ranking: TechnicianRankingData[],
    mes: number,
    año: number,
  ): Promise<void> {
    try {
      const historyEntries = ranking.map((item) => ({
        tecnicoId: item.tecnicoId,
        mes,
        año,
        puesto: item.puesto,
        puntajeTotal: item.puntajeTotal,
        calificacionPromedio: item.metrics.calificacionPromedio,
        totalOrdenes: item.metrics.totalOrdenes,
        puntualidad: item.metrics.puntualidad,
        vecesLider: item.metrics.esLider,
        metadata: JSON.stringify({
          tendencia: item.tendencia,
          variacionPuesto: item.variacionPuesto,
        }),
      }));

      await this.rankingHistoryRepository
        .createQueryBuilder()
        .insert()
        .into(TechnicianRankingHistory)
        .values(historyEntries)
        .orUpdate(
          [
            'puesto',
            'puntaje_total',
            'calificacion_promedio',
            'total_ordenes',
            'puntualidad',
            'veces_lider',
            'metadata',
            'fecha_calculo',
          ],
          ['tecnico_id', 'mes', 'año'],
        )
        .execute();
    } catch (error) {
      this.logger.error(`Error guardando ranking histórico: ${error.message}`);
    }
  }

  /**
   * Obtiene ranking almacenado de un mes específico
   */
  private async getStoredRanking(
    mes: number,
    año: number,
  ): Promise<TechnicianRankingData[] | null> {
    const historico = await this.rankingHistoryRepository.find({
      where: { mes, año },
      order: { puesto: 'ASC' },
    });

    if (!historico.length) return null;

    const tecnicoIds = historico.map((h) => h.tecnicoId);
    const tecnicos = await this.userRepository.find({
      where: { usuarioId: In(tecnicoIds) },
    });

    const tecnicosMap = new Map(tecnicos.map((t) => [t.usuarioId, t]));

    return historico.map((item) => {
      const tecnico = tecnicosMap.get(item.tecnicoId);
      const metadata = item.metadata ? JSON.parse(item.metadata as string) : {};

      return {
        tecnicoId: item.tecnicoId,
        nombre: tecnico?.nombre || 'Desconocido',
        apellido: tecnico?.apellido || null,
        metrics: {
          calificacionPromedio: Number(item.calificacionPromedio),
          totalOrdenes: item.totalOrdenes,
          puntualidad: Number(item.puntualidad),
          esLider: item.vecesLider,
        },
        puntajeTotal: Number(item.puntajeTotal),
        puesto: item.puesto,
        tendencia: metadata.tendencia || 'stable',
        variacionPuesto: metadata.variacionPuesto || 0,
      };
    });
  }

  /**
   * Obtiene el ranking con estrategia de caché
   */
  async getMonthlyRankingWithCache(
    mes: number,
    año: number,
    currentUser?: any,
    forceRecalculate: boolean = false,
  ): Promise<MonthlyRanking> {
    const roleName = currentUser?.role?.nombreRol || currentUser?.role || '';

    // Para técnicos, siempre recalcular (no usar caché)
    if (roleName === 'Técnico') {
      return this.calculateMonthlyRanking(mes, año, currentUser, false);
    }

    // Para admin/supervisor/secretaria, usar caché si está disponible
    if (!forceRecalculate) {
      const cached = await this.getStoredRanking(mes, año);
      if (cached) {
        return {
          mes,
          año,
          fechaCalculo: new Date(),
          ranking: cached.slice(0, 10),
          totalTecnicos: cached.length,
        };
      }
    }

    return this.calculateMonthlyRanking(mes, año, currentUser, true);
  }

  /**
   * Obtiene el ranking actual (para el dashboard)
   */
  async getCurrentMonthRanking(currentUser?: any): Promise<MonthlyRanking> {
    const now = new Date();
    const mes = now.getMonth() + 1;
    const año = now.getFullYear();

    return this.getMonthlyRankingWithCache(mes, año, currentUser);
  }

  /**
   * Obtiene la evolución histórica de un técnico
   */
  async getTechnicianEvolution(
    tecnicoId: number,
    meses: number = 6,
  ): Promise<TechnicianEvolution> {
    const tecnico = await this.userRepository.findOne({
      where: { usuarioId: tecnicoId },
    });

    if (!tecnico) {
      throw new NotFoundException(`Técnico con ID ${tecnicoId} no encontrado`);
    }

    const historial = await this.rankingHistoryRepository
      .createQueryBuilder('rh')
      .where('rh.tecnicoId = :tecnicoId', { tecnicoId })
      .orderBy('rh.año', 'DESC')
      .addOrderBy('rh.mes', 'DESC')
      .limit(meses)
      .getMany();

    return {
      tecnicoId,
      nombre: tecnico.nombre,
      apellido: tecnico.apellido,
      historial: historial.map((h) => ({
        mes: h.mes,
        año: h.año,
        puesto: h.puesto,
        puntajeTotal: Number(h.puntajeTotal),
        calificacionPromedio: Number(h.calificacionPromedio),
        totalOrdenes: h.totalOrdenes,
      })),
    };
  }

  /**
   * Obtiene estadísticas globales del ranking
   */
  async getRankingStats(currentUser?: any): Promise<RankingStats> {
    const roleName = currentUser?.role?.nombreRol || currentUser?.role || '';
    const userId = currentUser?.userId;

    // Si es técnico, solo ver sus propias estadísticas
    if (roleName === 'Técnico' && userId) {
      return this.getTechnicianPersonalStats(userId);
    }

    // Para admin/supervisor/secretaria, ver estadísticas globales
    const totalTecnicosActivos = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .where('role.nombreRol = :rol', { rol: 'Técnico' })
      .andWhere('user.activo = :activo', { activo: true })
      .getCount();

    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

    const promedioGeneral = await this.workOrderTechnicianRepository
      .createQueryBuilder('wot')
      .innerJoin('wot.workOrder', 'wo')
      .where('wo.fechaFinalizacion >= :fechaLimite', {
        fechaLimite: tresMesesAtras,
      })
      .andWhere('wot.rating IS NOT NULL')
      .select('AVG(CAST(wot.rating AS DECIMAL(3,1)))', 'promedio')
      .getRawOne();

    const now = new Date();
    const mesActual = now.getMonth() + 1;
    const añoActual = now.getFullYear();
    const startDate = new Date(añoActual, mesActual - 1, 1);
    const endDate = new Date(añoActual, mesActual, 0, 23, 59, 59);

    const mejorCalificacion = await this.workOrderTechnicianRepository
      .createQueryBuilder('wot')
      .innerJoin('wot.workOrder', 'wo')
      .where('wo.fechaFinalizacion BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('wot.rating IS NOT NULL')
      .orderBy('wot.rating', 'DESC')
      .getOne();

    const rankingActual = await this.getCurrentMonthRanking(currentUser);
    const tecnicoDelMes = rankingActual.ranking[0] || null;

    const ordenesPromedio = await this.workOrderRepository
      .createQueryBuilder('wo')
      .innerJoin('wo.technicians', 'wot')
      .where('wo.fechaFinalizacion BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('wo.estado = :estado', { estado: WorkOrderStatus.COMPLETED })
      .select(
        'COUNT(DISTINCT wo.ordenId) / NULLIF(COUNT(DISTINCT wot.tecnicoId), 0)',
        'promedio',
      )
      .getRawOne();

    return {
      totalTecnicosActivos,
      promedioGeneral: Number(promedioGeneral?.promedio || 0),
      mejorCalificacionMes: mejorCalificacion
        ? Number(mejorCalificacion.rating)
        : 0,
      tecnicoDelMes: tecnicoDelMes
        ? {
            tecnicoId: tecnicoDelMes.tecnicoId,
            nombre: tecnicoDelMes.nombre,
            apellido: tecnicoDelMes.apellido,
            puntajeTotal: tecnicoDelMes.puntajeTotal,
          }
        : null,
      ordenesPromedioPorTecnico: Number(ordenesPromedio?.promedio || 0),
    };
  }

  /**
   * Obtiene estadísticas personales de un técnico
   */
  private async getTechnicianPersonalStats(
    tecnicoId: number,
  ): Promise<RankingStats> {
    const tecnico = await this.userRepository.findOne({
      where: { usuarioId: tecnicoId },
    });

    if (!tecnico) {
      throw new NotFoundException(`Técnico con ID ${tecnicoId} no encontrado`);
    }

    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

    // Promedio personal de calificaciones
    const promedioPersonal = await this.workOrderTechnicianRepository
      .createQueryBuilder('wot')
      .innerJoin('wot.workOrder', 'wo')
      .where('wot.tecnicoId = :tecnicoId', { tecnicoId })
      .andWhere('wo.fechaFinalizacion >= :fechaLimite', {
        fechaLimite: tresMesesAtras,
      })
      .andWhere('wot.rating IS NOT NULL')
      .select('AVG(CAST(wot.rating AS DECIMAL(3,1)))', 'promedio')
      .getRawOne();

    const now = new Date();
    const mesActual = now.getMonth() + 1;
    const añoActual = now.getFullYear();
    const startDate = new Date(añoActual, mesActual - 1, 1);
    const endDate = new Date(añoActual, mesActual, 0, 23, 59, 59);

    // Mejor calificación personal del mes
    const mejorCalificacionPersonal = await this.workOrderTechnicianRepository
      .createQueryBuilder('wot')
      .innerJoin('wot.workOrder', 'wo')
      .where('wot.tecnicoId = :tecnicoId', { tecnicoId })
      .andWhere('wo.fechaFinalizacion BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('wot.rating IS NOT NULL')
      .orderBy('wot.rating', 'DESC')
      .getOne();

    // Total de órdenes completadas en el mes
    const ordenesCompletadasMes = await this.workOrderTechnicianRepository
      .createQueryBuilder('wot')
      .innerJoin('wot.workOrder', 'wo')
      .where('wot.tecnicoId = :tecnicoId', { tecnicoId })
      .andWhere('wo.fechaFinalizacion BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('wo.estado = :estado', { estado: WorkOrderStatus.COMPLETED })
      .getCount();

    // Obtener su posición en el ranking actual
    const rankingActual = await this.calculateMonthlyRanking(
      mesActual,
      añoActual,
      { role: { nombreRol: 'Técnico' }, userId: tecnicoId },
      false,
    );

    const miPosicion =
      rankingActual.ranking.find((r) => r.tecnicoId === tecnicoId) || null;

    return {
      totalTecnicosActivos: 1, // Para un técnico, solo se ve a sí mismo
      promedioGeneral: Number(promedioPersonal?.promedio || 0),
      mejorCalificacionMes: mejorCalificacionPersonal
        ? Number(mejorCalificacionPersonal.rating)
        : 0,
      tecnicoDelMes: miPosicion
        ? {
            tecnicoId: miPosicion.tecnicoId,
            nombre: miPosicion.nombre,
            apellido: miPosicion.apellido,
            puntajeTotal: miPosicion.puntajeTotal,
          }
        : null,
      ordenesPromedioPorTecnico: ordenesCompletadasMes, // Usamos esto como "órdenes en el mes"
    };
  }

  /**
   * Obtiene el ranking histórico completo con paginación
   */
  async getHistoricalRanking(options?: {
    page?: number;
    limit?: number;
    mes?: number;
    año?: number;
    tecnicoId?: number;
  }): Promise<{
    data: TechnicianRankingData[];
    total: number;
    page: number;
    limit: number;
    mes?: number;
    año?: number;
  }> {
    const { page = 1, limit = 20, mes, año, tecnicoId } = options || {};

    const query = this.rankingHistoryRepository
      .createQueryBuilder('rh')
      .orderBy('rh.año', 'DESC')
      .addOrderBy('rh.mes', 'DESC')
      .addOrderBy('rh.puesto', 'ASC');

    if (mes && año) {
      query.andWhere('rh.mes = :mes AND rh.año = :año', { mes, año });
    }

    if (tecnicoId) {
      query.andWhere('rh.tecnicoId = :tecnicoId', { tecnicoId });
    }

    const total = await query.getCount();

    const historico = await query
      .offset((page - 1) * limit)
      .limit(limit)
      .getMany();

    const tecnicoIds = [...new Set(historico.map((h) => h.tecnicoId))];
    const tecnicos = await this.userRepository.find({
      where: { usuarioId: In(tecnicoIds) },
    });

    const tecnicosMap = new Map(tecnicos.map((t) => [t.usuarioId, t]));

    const data = historico.map((item) => {
      const tecnico = tecnicosMap.get(item.tecnicoId);
      const metadata = item.metadata ? JSON.parse(item.metadata as string) : {};

      return {
        tecnicoId: item.tecnicoId,
        nombre: tecnico?.nombre || 'Desconocido',
        apellido: tecnico?.apellido || null,
        metrics: {
          calificacionPromedio: Number(item.calificacionPromedio),
          totalOrdenes: item.totalOrdenes,
          puntualidad: Number(item.puntualidad),
          esLider: item.vecesLider,
        },
        puntajeTotal: Number(item.puntajeTotal),
        puesto: item.puesto,
        tendencia: metadata.tendencia || 'stable',
        variacionPuesto: metadata.variacionPuesto || 0,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      mes,
      año,
    };
  }

  /**
   * Obtiene los mejores técnicos por categoría
   */
  async getTopTechniciansByCategory(
    category: 'calificacion' | 'productividad' | 'puntualidad',
    limit: number = 5,
    mes?: number,
    año?: number,
  ): Promise<TechnicianRankingData[]> {
    const now = new Date();
    const targetMes = mes || now.getMonth() + 1;
    const targetAño = año || now.getFullYear();

    const ranking = await this.getMonthlyRankingWithCache(
      targetMes,
      targetAño,
      null,
      false,
    );

    let sorted = [...ranking.ranking];

    switch (category) {
      case 'calificacion':
        sorted.sort(
          (a, b) =>
            b.metrics.calificacionPromedio - a.metrics.calificacionPromedio,
        );
        break;
      case 'productividad':
        sorted.sort((a, b) => b.metrics.totalOrdenes - a.metrics.totalOrdenes);
        break;
      case 'puntualidad':
        sorted.sort((a, b) => b.metrics.puntualidad - a.metrics.puntualidad);
        break;
    }

    return sorted.slice(0, limit);
  }
}
