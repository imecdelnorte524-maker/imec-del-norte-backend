import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NotificationsService } from '../notifications.service';
import { NotificationType } from '../enums/notification-types.enum';

interface WorkOrderCreatedEvent {
  workOrderId: number;
  clienteId: number;
  tecnicoId?: number | null;
  servicioId: number;
}

interface WorkOrderAssignedEvent {
  workOrderId: number;
  clienteId: number;
  tecnicoId: number;
  servicioId: number;
}

@Injectable()
export class WorkOrdersNotificationsListener {
  private readonly logger = new Logger(WorkOrdersNotificationsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  @OnEvent('work-order.created')
  async handleWorkOrderCreated(payload: WorkOrderCreatedEvent) {
    this.logger.log(`📢 Evento recibido: work-order.created ID: ${payload.workOrderId}`);

    // Buscar usuarios con rol Administrador o Secretaria
    const admins = await this.usersRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('role.nombreRol IN (:...rol)', { rol: ['Administrador', 'Secretaria'] })
      .andWhere('user.activo = true')
      .getMany();

    this.logger.log(`👥 Encontrados ${admins.length} usuarios para notificar (Admin/Secretaria).`);

    const notificaciones = admins.map((admin) =>
      this.notificationsService.createAndSend({
        usuarioId: admin.usuarioId,
        tipo: NotificationType.WORK_ORDER_CREATED,
        titulo: 'Nueva orden de trabajo',
        mensaje: `Se ha creado la orden #${payload.workOrderId}`,
        data: payload,
      }),
    );

    await Promise.all(notificaciones);
  }

  @OnEvent('work-order.assigned')
  async handleWorkOrderAssigned(payload: WorkOrderAssignedEvent) {
    this.logger.log(`📢 Evento recibido: work-order.assigned ID: ${payload.workOrderId}`);

    // Buscar al técnico asignado con su rol
    const tecnico = await this.usersRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.usuarioId = :tecnicoId', { tecnicoId: payload.tecnicoId })
      .andWhere('role.nombreRol = :rol', { rol: 'Tecnico' })
      .andWhere('user.activo = true')
      .getOne();

    if (!tecnico) {
      this.logger.warn(`⚠️ Técnico ${payload.tecnicoId} no encontrado, inactivo o no tiene rol de Técnico.`);
      return;
    }

    await this.notificationsService.createAndSend({
      usuarioId: tecnico.usuarioId,
      tipo: NotificationType.WORK_ORDER_ASSIGNED,
      titulo: 'Nueva orden asignada',
      mensaje: `Se le ha asignado la orden #${payload.workOrderId}`,
      data: payload,
    });
  }
}