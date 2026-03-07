// notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { 
  NotificationType, 
  NotificationModule, 
  NotificationPriority,
  NotificationTypeToModule,
  NotificationPriorityByType 
} from '../shared/index';
import { NotificationsGateway } from './notifications.gateway';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepo: Repository<Notification>,
    private readonly gateway: NotificationsGateway,
  ) {}

  async createAndSend(dto: CreateNotificationDto, excludeSocketId?: string): Promise<Notification> {
    const modulo = dto.modulo || NotificationTypeToModule[dto.tipo];
    const prioridad = dto.prioridad || NotificationPriorityByType[dto.tipo];

    const notification = this.notificationsRepo.create({
      usuarioId: dto.usuarioId,
      tipo: dto.tipo,
      modulo,
      prioridad,
      titulo: dto.titulo,
      mensaje: dto.mensaje,
      mensajeCorto: dto.mensajeCorto || this.generateShortMessage(dto),
      data: dto.data ?? null,
      accion: dto.accion ?? this.generateDefaultAction(dto),
      visibleHasta: dto.visibleHasta ?? this.calculateExpirationDate(dto.tipo),
    });

    const saved = await this.notificationsRepo.save(notification);

    // Enviar por WebSocket (excluyendo el socket especificado)
    this.gateway.sendToUser(dto.usuarioId, saved, excludeSocketId);

    this.logger.debug(`📨 Notificación #${saved.notificacionId} enviada: ${saved.tipo} a usuario ${dto.usuarioId}`);

    return saved;
  }

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const modulo = dto.modulo || NotificationTypeToModule[dto.tipo];
    const prioridad = dto.prioridad || NotificationPriorityByType[dto.tipo];

    const notification = this.notificationsRepo.create({
      usuarioId: dto.usuarioId,
      tipo: dto.tipo,
      modulo,
      prioridad,
      titulo: dto.titulo,
      mensaje: dto.mensaje,
      mensajeCorto: dto.mensajeCorto || this.generateShortMessage(dto),
      data: dto.data ?? null,
      accion: dto.accion ?? this.generateDefaultAction(dto),
      visibleHasta: dto.visibleHasta ?? this.calculateExpirationDate(dto.tipo),
    });

    const saved = await this.notificationsRepo.save(notification);
    this.logger.debug(`📝 Notificación #${saved.notificacionId} guardada en BD`);

    return saved;
  }

  async findForUser(
    usuarioId: number,
    filters: {
      onlyUnread?: boolean;
      modulo?: NotificationModule;
      prioridad?: NotificationPriority;
      desde?: Date;
      hasta?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const {
      onlyUnread = false,
      modulo,
      prioridad,
      desde,
      hasta,
      limit = 50,
      offset = 0,
    } = filters;

    const query = this.notificationsRepo.createQueryBuilder('n')
      .where('n.usuarioId = :usuarioId', { usuarioId })
      .andWhere('(n.visibleHasta IS NULL OR n.visibleHasta > NOW())');

    if (onlyUnread) {
      query.andWhere('n.leida = false');
    }

    if (modulo) {
      query.andWhere('n.modulo = :modulo', { modulo });
    }

    if (prioridad) {
      query.andWhere('n.prioridad = :prioridad', { prioridad });
    }

    if (desde) {
      query.andWhere('n.fechaCreacion >= :desde', { desde });
    }

    if (hasta) {
      query.andWhere('n.fechaCreacion <= :hasta', { hasta });
    }

    return query
      .orderBy('n.fechaCreacion', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();
  }

  async getUnreadCountByModule(usuarioId: number): Promise<Record<NotificationModule, number>> {
    const result = await this.notificationsRepo
      .createQueryBuilder('n')
      .select('n.modulo', 'modulo')
      .addSelect('COUNT(*)', 'count')
      .where('n.usuarioId = :usuarioId', { usuarioId })
      .andWhere('n.leida = false')
      .andWhere('(n.visibleHasta IS NULL OR n.visibleHasta > NOW())')
      .groupBy('n.modulo')
      .getRawMany();

    const counts = {} as Record<NotificationModule, number>;
    
    Object.values(NotificationModule).forEach(module => {
      counts[module] = 0;
    });

    result.forEach(row => {
      counts[row.modulo] = parseInt(row.count, 10);
    });

    return counts;
  }

  async markAsRead(usuarioId: number, notificacionId: number): Promise<void> {
    await this.notificationsRepo.update(
      { notificacionId, usuarioId },
      { 
        leida: true,
        fechaLectura: new Date()
      }
    );
  }

  async markAllAsRead(usuarioId: number, modulo?: NotificationModule): Promise<void> {
    const where: any = { usuarioId, leida: false };
    
    if (modulo) {
      where.modulo = modulo;
    }

    await this.notificationsRepo.update(
      where,
      { 
        leida: true,
        fechaLectura: new Date()
      }
    );
  }

  async cleanOldNotifications(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.notificationsRepo.delete({
      leida: true,
      fechaCreacion: LessThan(cutoffDate),
    });

    this.logger.log(`🧹 Limpieza automática: ${result.affected} notificaciones eliminadas`);
    
    return result.affected || 0;
  }

  private generateShortMessage(dto: CreateNotificationDto): string {
    if (dto.mensajeCorto) return dto.mensajeCorto;
    return dto.mensaje.substring(0, 97) + '...';
  }

  private generateDefaultAction(dto: CreateNotificationDto) {
    switch (dto.tipo) {
      case NotificationType.WORK_ORDER_CREATED:
      case NotificationType.WORK_ORDER_ASSIGNED:
        return {
          label: 'Ver orden',
          ruta: `/work-orders/${dto.data?.workOrderId}`,
        };
      
      case NotificationType.STOCK_BELOW_MIN:
        return {
          label: 'Ver insumo',
          ruta: `/inventory/${dto.data?.insumoId}`,
        };
      
      default:
        return null;
    }
  }

  private calculateExpirationDate(tipo: NotificationType): Date | null {
    const now = new Date();
    
    switch (tipo) {
      case NotificationType.SYSTEM_MAINTENANCE:
        now.setDate(now.getDate() + 7);
        return now;
      
      case NotificationType.STOCK_EXPIRING:
        now.setDate(now.getDate() + 15);
        return now;
      
      case NotificationType.WORK_ORDER_ASSIGNED:
        now.setDate(now.getDate() + 30);
        return now;
      
      default:
        now.setDate(now.getDate() + 90);
        return now;
    }
  }
}