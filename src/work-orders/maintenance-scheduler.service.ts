import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { PlanMantenimiento } from '../equipment/entities/plan-mantenimiento.entity';
import { WorkOrdersService } from './work-orders.service';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { UnidadFrecuencia } from '../shared/index';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diffEnDias(fechaObjetivo: Date, hoy: Date): number {
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.round(
    (startOfDay(fechaObjetivo).getTime() - startOfDay(hoy).getTime()) /
      msPorDia,
  );
}

function sumarDias(fecha: Date, dias: number): Date {
  const f = startOfDay(fecha);
  f.setDate(f.getDate() + dias);
  return f;
}

function formatDate(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

// Helpers para avanzar planes segun frecuencia
function addMonths(date: Date, months: number): Date {
  const d = startOfDay(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);

  // Ajuste por meses cortos
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

function nextPlanDate(
  current: Date,
  unidad: UnidadFrecuencia,
  step: number,
): Date {
  switch (unidad) {
    case UnidadFrecuencia.DIA:
      return sumarDias(current, step);
    case UnidadFrecuencia.SEMANA:
      return sumarDias(current, step * 7);
    case UnidadFrecuencia.MES:
      return addMonths(current, step);
    default:
      return current;
  }
}

function adjustToWorkingDay(date: Date): Date {
  const d = startOfDay(date);
  // 0 = Domingo
  if (d.getDay() === 0) {
    return sumarDias(d, 1); // Pasar al lunes
  }
  return d;
}

@Injectable()
export class MaintenanceSchedulerService {
  private readonly logger = new Logger(MaintenanceSchedulerService.name);

  constructor(
    @InjectRepository(PlanMantenimiento)
    private readonly planRepo: Repository<PlanMantenimiento>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly workOrdersService: WorkOrdersService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Crea órdenes automáticas:
   * - 5 días antes de la fecha programada
   * - El mismo día si no se creó antes
   * - Si está atrasado y no tiene orden
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async procesarMantenimientosPeriodicos() {
    const hoy = startOfDay(new Date());
    const hoyStr = formatDate(hoy);

    this.logger.log(
      `⏱ [procesarMantenimientosPeriodicos] Ejecutando CRON (${hoyStr})`,
    );

    try {
      // Buscar TODOS los planes (sin filtro activo ya que no existe)
      const planes = await this.planRepo.find({
        relations: ['equipment', 'equipment.client'],
      });

      let ordenesCreadas = 0;

      for (const plan of planes) {
        try {
          if (!plan.fechaProgramada || !plan.equipmentId) {
            this.logger.debug(`Plan ${plan.id} sin fecha o equipo, omitiendo`);
            continue;
          }

          const fechaPlan = startOfDay(new Date(plan.fechaProgramada));
          const diffDias = diffEnDias(fechaPlan, hoy);

          // Verificar si ya existe orden para este plan en esta fecha
          const yaExiste =
            await this.workOrdersService.existeOrdenParaPlanEnFecha(
              plan.id,
              fechaPlan,
            );

          const debeCrear =
            (diffDias === 5 && !yaExiste) || // 5 días antes
            (diffDias === 0 && !yaExiste) || // Hoy mismo
            (diffDias < 0 && !yaExiste); // Atrasado

          if (!debeCrear) {
            continue;
          }

          this.logger.log(
            `🎯 Creando orden automática para plan ${plan.id}, fecha ${formatDate(fechaPlan)} (diff=${diffDias})`,
          );

          await this.workOrdersService.createFromMaintenancePlan({
            plan,
            fechaProgramada: fechaPlan,
          });

          ordenesCreadas++;
        } catch (error: any) {
          this.logger.error(
            `Error procesando plan ${plan.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log(
        `✅ Órdenes creadas en esta ejecución: ${ordenesCreadas}`,
      );
    } catch (error: any) {
      this.logger.error(
        `[procesarMantenimientosPeriodicos] Error general: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Actualiza automáticamente fechaProgramada de todos los planes:
   * - Avanza la fecha según unidadFrecuencia si la fecha actual ya pasó
   * - Ajusta al lunes si cae domingo
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async actualizarFechasPlanes() {
    const hoy = startOfDay(new Date());
    const hoyStr = formatDate(hoy);

    this.logger.log(
      `⏱ [actualizarFechasPlanes] Ejecutando CRON (hoy = ${hoyStr})`,
    );

    try {
      // Buscar planes con fecha en el pasado (sin filtro activo)
      const planes = await this.planRepo.find({
        where: {
          fechaProgramada: LessThan(hoy),
        },
      });

      this.logger.log(
        `📊 Planes con fecha pasada encontrados: ${planes.length}`,
      );

      let planesActualizados = 0;

      for (const plan of planes) {
        try {
          if (!plan.fechaProgramada || !plan.unidadFrecuencia) {
            this.logger.debug(
              `Plan ${plan.id} sin unidad de frecuencia, omitiendo`,
            );
            continue;
          }

          let fechaPlan = startOfDay(new Date(plan.fechaProgramada));
          const unidad = plan.unidadFrecuencia;
          const step = plan.diaDelMes ?? 1;
          let fechaOriginal = fechaPlan;
          let iteraciones = 0;
          const MAX_ITERACIONES = 12; // Evitar loops infinitos

          // Avanzar hasta que la fecha sea >= hoy
          while (fechaPlan < hoy && iteraciones < MAX_ITERACIONES) {
            fechaPlan = adjustToWorkingDay(
              nextPlanDate(fechaPlan, unidad, step),
            );
            iteraciones++;
          }

          if (iteraciones >= MAX_ITERACIONES) {
            this.logger.warn(
              `Plan ${plan.id}: alcanzó máximo de iteraciones, posible error en configuración`,
            );
            continue;
          }

          if (formatDate(fechaOriginal) !== formatDate(fechaPlan)) {
            plan.fechaProgramada = fechaPlan;
            await this.planRepo.save(plan);
            planesActualizados++;

            this.logger.log(
              `🔁 Plan ${plan.id}: ${formatDate(fechaOriginal)} -> ${formatDate(fechaPlan)} (${iteraciones} iteraciones)`,
            );
          }
        } catch (error: any) {
          this.logger.error(
            `Error actualizando plan ${plan.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log(`✅ Planes actualizados: ${planesActualizados}`);
    } catch (error: any) {
      this.logger.error(
        `[actualizarFechasPlanes] Error general: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * JOB DIARIO (06:00):
   * - SOLO LOS VIERNES: envía correo a Administradores/Secretarias con
   *   los mantenimientos de la semana siguiente (lunes a sábado)
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async enviarRecordatorioSemanal() {
    const hoy = startOfDay(new Date());
    const diaSemana = hoy.getDay(); // 0=domingo, 5=viernes

    // Solo ejecutar los VIERNES
    if (diaSemana !== 5) {
      this.logger.debug(
        `[enviarRecordatorioSemanal] Hoy no es viernes (${diaSemana}), omitiendo`,
      );
      return;
    }

    // Lunes siguiente (hoy + 3) y sábado siguiente (hoy + 8)
    const inicio = sumarDias(hoy, 3); // lunes
    const fin = sumarDias(hoy, 8); // sábado

    this.logger.log(
      `📧 [enviarRecordatorioSemanal] Buscando mantenimientos entre ${formatDate(inicio)} y ${formatDate(fin)}`,
    );

    try {
      // Buscar planes en el rango de fechas
      const planes = await this.planRepo
        .createQueryBuilder('plan')
        .leftJoinAndSelect('plan.equipment', 'equipment')
        .leftJoinAndSelect('equipment.client', 'client')
        .where('plan.fechaProgramada BETWEEN :inicio AND :fin', {
          inicio: inicio.toISOString(),
          fin: fin.toISOString(),
        })
        .orderBy('plan.fechaProgramada', 'ASC')
        .getMany();

      if (!planes.length) {
        this.logger.log(
          '📭 No hay mantenimientos programados para la semana siguiente',
        );
        return;
      }

      // Buscar administradores y secretarias con email
      const admins = await this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .where('role.nombreRol IN (:...roles)', {
          roles: ['Administrador', 'Secretaria'],
        })
        .andWhere('user.email IS NOT NULL')
        .andWhere('user.email != :empty', { empty: '' })
        .getMany();

      const emails = [
        ...new Set(admins.map((u) => u.email).filter(Boolean)),
      ] as string[];

      if (!emails.length) {
        this.logger.warn(
          '⚠️ No se encontraron destinatarios con email para el recordatorio',
        );
        return;
      }

      // Preparar items para el email (usando solo campos que existen)
      const items = planes.map((plan) => ({
        equipmentId: plan.equipmentId,
        equipmentCode: plan.equipment?.code ?? `EQ-${plan.equipmentId}`,
        clientName: plan.equipment?.client?.nombre ?? 'Sin cliente',
        fechaProgramada: startOfDay(new Date(plan.fechaProgramada!)),
        unidadFrecuencia: plan.unidadFrecuencia ?? null,
        diaDelMes: plan.diaDelMes ?? null,
        notas: plan.notas ?? undefined,
      }));

      // Enviar email (sin weekStart/weekEnd si no existen en el DTO)
      await this.mailService.sendMaintenanceReminderEmail({
        to: emails,
        items,
      });

      this.logger.log(
        `✅ Recordatorio enviado a: ${emails.join(', ')} (${items.length} mantenimientos)`,
      );
    } catch (error: any) {
      this.logger.error(
        `Error enviando recordatorio: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Método auxiliar para verificar si ya existe una orden
   */
  private async existeOrdenParaPlanEnFecha(
    planId: number,
    fecha: Date,
  ): Promise<boolean> {
    try {
      return await this.workOrdersService.existeOrdenParaPlanEnFecha(
        planId,
        fecha,
      );
    } catch (error) {
      this.logger.error(
        `Error verificando existencia de orden: ${error.message}`,
      );
      return false;
    }
  }
}
