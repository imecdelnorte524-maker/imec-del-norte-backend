// src/work-orders/maintenance-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanMantenimiento } from '../equipment/entities/plan-mantenimiento.entity';
import { WorkOrdersService } from './work-orders.service';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';

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

  @Cron(CronExpression.EVERY_5_MINUTES)
  async procesarMantenimientosPeriodicos() {
    const hoy = startOfDay(new Date());
    const hoyStr = formatDate(hoy);
    this.logger.log(
      `Revisando planes de mantenimiento para creación automática de órdenes (${hoyStr})`,
    );

    try {
      const planes = await this.planRepo.find({
        relations: ['equipment', 'equipment.client'],
      });

      for (const plan of planes) {
        try {
          if (!plan.fechaProgramada || !plan.equipmentId) continue;

          const fechaPlan = startOfDay(new Date(plan.fechaProgramada));
          const diff = diffEnDias(fechaPlan, hoy);

          // Regla:
          // - diff === 2 → crear orden 2 días antes
          // - diff === 0 → crear el mismo día si por algún motivo no se creó antes
          if (diff !== 2 && diff !== 0) {
            continue;
          }

          const yaExiste =
            await this.workOrdersService.existeOrdenParaPlanEnFecha(
              plan.id,
              fechaPlan,
            );

          if (yaExiste) {
            this.logger.debug(
              `Ya existe orden para plan ${plan.id} en fecha ${formatDate(
                fechaPlan,
              )}`,
            );
            continue;
          }

          this.logger.log(
            `Creando orden automática para plan ${plan.id}, equipo ${plan.equipmentId}, fecha ${formatDate(
              fechaPlan,
            )} (diff=${diff})`,
          );

          await this.workOrdersService.createFromMaintenancePlan({
            plan,
            fechaProgramada: fechaPlan,
          });
        } catch (error: any) {
          this.logger.error(
            `Error procesando plan ${plan.id}: ${error.message}`,
            error.stack,
          );
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Error general procesando mantenimientos periódicos: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * JOB DIARIO (06:00):
   * - Solo los LUNES: envía correo a Administradores/Secretarias con
   *   mantenimientos de los próximos 7 días.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async enviarRecordatorioSemanal() {
    const hoy = startOfDay(new Date());
    const diaSemana = hoy.getDay(); // 0=domingo, 1=lunes, ...

    // Solo correr los lunes
    if (diaSemana !== 1) {
      return;
    }

    const inicio = hoy;
    const fin = sumarDias(hoy, 7);

    this.logger.log(
      `Generando correo de mantenimientos programados entre ${formatDate(
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
          'No hay mantenimientos programados para los próximos 7 días',
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
          'No se encontraron administradores con email para enviar recordatorio de mantenimientos',
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
        `Correo de mantenimientos programados enviado a: ${emails.join(', ')}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Error enviando correo de mantenimientos: ${error.message}`,
        error.stack,
      );
    }
  }
}