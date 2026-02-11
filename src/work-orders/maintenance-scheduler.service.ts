// src/work-orders/maintenance-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanMantenimiento } from '../equipment/entities/plan-mantenimiento.entity';
import { WorkOrdersService } from './work-orders.service';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { UnidadFrecuencia } from '../equipment/enums/frecuency-unity.enum';

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
   * - diff === 5 → crea orden 5 días antes de la fecha programada
   * - diff === 0 → crea orden el mismo día si por alguna razón no se creó antes
   */
  // @Cron(CronExpression.EVERY_5_MINUTES)
  async procesarMantenimientosPeriodicos() {
    const hoy = startOfDay(new Date());
    const hoyStr = formatDate(hoy);

    this.logger.log(
      `⏱ [procesarMantenimientosPeriodicos] Ejecutando CRON (${hoyStr})`,
    );

    try {
      const planes = await this.planRepo.find({
        relations: ['equipment', 'equipment.client'],
      });

      this.logger.log(
        `⏱ [procesarMantenimientosPeriodicos] Planes encontrados: ${planes.length}`,
      );

      for (const plan of planes) {
        try {
          if (!plan.fechaProgramada || !plan.equipmentId) continue;

          const fechaPlan = startOfDay(new Date(plan.fechaProgramada));
          const diff = diffEnDias(fechaPlan, hoy);

          // Nueva regla: 5 días antes ó el mismo día
          if (diff !== 5 && diff !== 0) {
            continue;
          }

          const yaExiste =
            await this.workOrdersService.existeOrdenParaPlanEnFecha(
              plan.id,
              fechaPlan,
            );

          if (yaExiste) {
            this.logger.debug(
              `[procesarMantenimientosPeriodicos] Ya existe orden para plan ${plan.id} en ${formatDate(
                fechaPlan,
              )}`,
            );
            continue;
          }

          this.logger.log(
            `🧾 Creando orden automática para plan ${plan.id}, equipo ${plan.equipmentId}, fecha ${formatDate(
              fechaPlan,
            )} (diff=${diff})`,
          );

          await this.workOrdersService.createFromMaintenancePlan({
            plan,
            fechaProgramada: fechaPlan,
          });
        } catch (error: any) {
          this.logger.error(
            `[procesarMantenimientosPeriodicos] Error procesando plan ${plan.id}: ${error.message}`,
            error.stack,
          );
        }
      }
    } catch (error: any) {
      this.logger.error(
        `[procesarMantenimientosPeriodicos] Error general: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Actualiza automáticamente fechaProgramada de todos los planes:
   * - Mientras fechaProgramada < hoy, la avanza según unidadFrecuencia / diaDelMes
   * - Si la nueva fecha cae domingo, la pasa al lunes.
   *
   * NOTA: ahora está cada 5 minutos para que lo veas fácil en logs.
   * Cuando lo tengas probado, puedes cambiarlo a EVERY_DAY_AT_1AM.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async actualizarFechasPlanes() {
    const hoy = startOfDay(new Date());
    const hoyStr = formatDate(hoy);

    this.logger.log(
      `⏱ [actualizarFechasPlanes] Ejecutando CRON (hoy = ${hoyStr})`,
    );

    try {
      const planes = await this.planRepo.find();
      this.logger.log(
        `⏱ [actualizarFechasPlanes] Planes encontrados: ${planes.length}`,
      );

      let planesActualizados = 0;

      for (const plan of planes) {
        try {
          if (!plan.fechaProgramada || !plan.unidadFrecuencia) continue;

          let fechaPlan = startOfDay(new Date(plan.fechaProgramada));
          const unidad = plan.unidadFrecuencia;
          const step = plan.diaDelMes ?? 1;

          let updated = false;

          // Mientras la fecha del plan esté en el pasado, avanzar
          while (fechaPlan < hoy) {
            const anterior = fechaPlan;
            fechaPlan = adjustToWorkingDay(
              nextPlanDate(fechaPlan, unidad, step),
            );
            updated = true;

            this.logger.log(
              `🔁 [actualizarFechasPlanes] Plan ${plan.id}: ${formatDate(
                anterior,
              )} -> ${formatDate(fechaPlan)}`,
            );
          }

          if (updated) {
            plan.fechaProgramada = fechaPlan;
            await this.planRepo.save(plan);
            planesActualizados++;
          }
        } catch (error: any) {
          this.logger.error(
            `[actualizarFechasPlanes] Error actualizando plan ${plan.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      if (planesActualizados === 0) {
        this.logger.log(
          `[actualizarFechasPlanes] No se actualizó ningún plan en esta ejecución.`,
        );
      } else {
        this.logger.log(
          `[actualizarFechasPlanes] Planes actualizados en esta ejecución: ${planesActualizados}`,
        );
      }
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
   *   los mantenimientos de la semana siguiente (lunes a sábado).
   *
   *  Ejemplo:
   *    Viernes 6 feb -> mantenimientos entre 9 y 14 feb
   *    Viernes 13 feb -> mantenimientos entre 16 y 21 feb
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async enviarRecordatorioSemanal() {
    const hoy = startOfDay(new Date());
    const diaSemana = hoy.getDay(); // 0=domingo, 5=viernes

    // Solo correr los VIERNES
    if (diaSemana !== 5) {
      return;
    }

    // Lunes siguiente (hoy + 3) y sábado siguiente (hoy + 8)
    const inicio = sumarDias(hoy, 3); // lunes
    const fin = sumarDias(hoy, 8); // sábado

    this.logger.log(
      `📧 [enviarRecordatorioSemanal] Generando correo de mantenimientos programados entre ${formatDate(
        inicio,
      )} y ${formatDate(fin)}`,
    );

    try {
      const planes = await this.planRepo
        .createQueryBuilder('plan')
        .leftJoinAndSelect('plan.equipment', 'equipment')
        .leftJoinAndSelect('equipment.client', 'client')
        .where('plan.fechaProgramada BETWEEN :inicio AND :fin', {
          inicio,
          fin,
        })
        .getMany();

      if (!planes.length) {
        this.logger.log(
          '[enviarRecordatorioSemanal] No hay mantenimientos programados para la semana siguiente',
        );
        return;
      }

      // Buscar administradores/secretarias con email
      const admins = await this.userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .where('role.nombreRol IN (:...roles)', {
          roles: ['Administrador', 'Secretaria'],
        })
        .andWhere('user.email IS NOT NULL')
        .getMany();

      const emails = admins.map((u) => u.email).filter(Boolean) as string[];

      if (!emails.length) {
        this.logger.warn(
          '[enviarRecordatorioSemanal] No se encontraron administradores con email para enviar recordatorio de mantenimientos',
        );
        return;
      }

      const items = planes.map((plan) => ({
        equipmentId: plan.equipmentId,
        equipmentCode: plan.equipment?.code ?? String(plan.equipmentId),
        clientName: plan.equipment?.client?.nombre ?? 'Sin cliente',
        fechaProgramada: startOfDay(new Date(plan.fechaProgramada!)),
        unidadFrecuencia: plan.unidadFrecuencia ?? null,
        diaDelMes: plan.diaDelMes ?? null,
        notas: plan.notas ?? undefined,
      }));

      await this.mailService.sendMaintenanceReminderEmail({
        to: emails,
        items,
      });

      this.logger.log(
        `📧 [enviarRecordatorioSemanal] Correo enviado a: ${emails.join(', ')}`,
      );
    } catch (error: any) {
      this.logger.error(
        `[enviarRecordatorioSemanal] Error enviando correo de mantenimientos: ${error.message}`,
        error.stack,
      );
    }
  }
}
