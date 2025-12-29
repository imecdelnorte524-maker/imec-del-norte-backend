import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationType } from './enums/notification-types.enum';
import { NotificationsGateway } from './notifications.gateway';

interface CreateNotificationDto {
  usuarioId: number;
  tipo: NotificationType;
  titulo: string;
  mensaje: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepo: Repository<Notification>,
    private readonly gateway: NotificationsGateway,
  ) {}

  async createAndSend(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationsRepo.create({
      usuarioId: dto.usuarioId,
      tipo: dto.tipo,
      titulo: dto.titulo,
      mensaje: dto.mensaje,
      data: dto.data ?? null,
    });

    const saved = await this.notificationsRepo.save(notification);

    // Enviar por WebSocket en tiempo real
    this.gateway.sendToUser(dto.usuarioId, saved);

    return saved;
  }

  async findForUser(usuarioId: number, onlyUnread = false) {
    return this.notificationsRepo.find({
      where: {
        usuarioId,
        ...(onlyUnread ? { leida: false } : {}),
      },
      order: { fechaCreacion: 'DESC' },
      take: 50,
    });
  }

  async markAsRead(usuarioId: number, notificacionId: number) {
    await this.notificationsRepo.update(
      { notificacionId, usuarioId },
      { leida: true },
    );
  }

  async markAllAsRead(usuarioId: number) {
    await this.notificationsRepo.update(
      { usuarioId, leida: false },
      { leida: true },
    );
  }
}