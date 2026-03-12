import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NotificationsService } from '../notifications.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { NotificationType } from '../../shared/index';

interface StockExpiringEvent {
  insumoId: number;
  nombre: string;
  lote: string;
  fechaVencimiento: Date;
  cantidad: number;
}

interface StockCreatedEvent {
  insumoId: number;
  nombre: string;
  cantidad: number;
  createdBy?: number;
}

@Injectable()
export class InventoryNotificationsListener {
  private readonly logger = new Logger(InventoryNotificationsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly realtime: RealtimeService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  @OnEvent('stock.expiring')
  async handleStockExpiring(payload: StockExpiringEvent) {
    this.logger.log(`📢 stock.expiring: insumo ${payload.insumoId}`);

    try {
      const admins = await this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol = :rol', { rol: 'Administrador' })
        .andWhere('user.activo = true')
        .getMany();

      if (admins.length === 0) return;

      const daysUntilExpiry = Math.ceil(
        (payload.fechaVencimiento.getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24),
      );

      const notifications = await Promise.all(
        admins.map((user) =>
          this.notificationsService.create({
            usuarioId: user.usuarioId,
            tipo: NotificationType.STOCK_EXPIRING,
            titulo: '📅 Insumo próximo a vencer',
            mensaje: `El insumo "${payload.nombre}" (Lote: ${payload.lote}) vence en ${daysUntilExpiry} días`,
            mensajeCorto: `Vence: ${payload.nombre}`,
            data: {
              insumoId: payload.insumoId,
              lote: payload.lote,
              fechaVencimiento: payload.fechaVencimiento,
              cantidad: payload.cantidad,
            },
            accion: {
              label: 'Ver insumo',
              ruta: `/inventory/${payload.insumoId}`,
            },
          }),
        ),
      );

      await Promise.all(
        notifications.map(async (notification) => {
          const unreadCount = await this.notificationsService.getUnreadCount(
            notification.usuarioId,
          );

          this.realtime.emitToUser(notification.usuarioId, 'notification', {
            notification,
          });

          this.realtime.emitUnreadCount(notification.usuarioId, unreadCount);
        }),
      );
    } catch (error) {
      this.logger.error(`❌ Error en stock.expiring: ${error.message}`);
    }
  }

  @OnEvent('stock.created')
  async handleStockCreated(payload: StockCreatedEvent) {
    this.logger.log(`📢 stock.created: insumo ${payload.insumoId}`);

    try {
      const admins = await this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.nombreRol IN (:...roles)', {
          roles: ['Administrador', 'Secretaria'],
        })
        .andWhere('user.activo = true')
        .getMany();

      if (admins.length === 0) return;

      const notifications = await Promise.all(
        admins.map((user) =>
          this.notificationsService.create({
            usuarioId: user.usuarioId,
            tipo: NotificationType.INVENTORY_ADJUSTED,
            titulo: '📦 Nuevo stock registrado',
            mensaje: `Se ha registrado entrada de ${payload.cantidad} unidades de "${payload.nombre}"`,
            mensajeCorto: `Stock actualizado: ${payload.nombre}`,
            data: {
              insumoId: payload.insumoId,
              cantidad: payload.cantidad,
              createdBy: payload.createdBy,
            },
            accion: {
              label: 'Ver insumo',
              ruta: `/inventory/${payload.insumoId}`,
            },
          }),
        ),
      );

      await Promise.all(
        notifications.map(async (notification) => {
          const unreadCount = await this.notificationsService.getUnreadCount(
            notification.usuarioId,
          );

          this.realtime.emitToUser(notification.usuarioId, 'notification', {
            notification,
          });

          this.realtime.emitUnreadCount(notification.usuarioId, unreadCount);
        }),
      );
    } catch (error) {
      this.logger.error(`❌ Error en stock.created: ${error.message}`);
    }
  }
}
