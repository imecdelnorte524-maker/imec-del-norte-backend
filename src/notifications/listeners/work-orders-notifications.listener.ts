import { Injectable } from '@nestjs/common';
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
  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  @OnEvent('work-order.created')
  async handleWorkOrderCreated(payload: WorkOrderCreatedEvent) {
    // Notificar a todos los Administradores activos
    const admins = await this.usersRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('role.nombreRol = :rol', { rol: 'Administrador' })
      .andWhere('user.activo = true')
      .getMany();

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
    // Buscar al técnico asignado
    const tecnico = await this.usersRepo.findOne({
      where: { usuarioId: payload.tecnicoId },
    });

    if (!tecnico || !tecnico.activo) {
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