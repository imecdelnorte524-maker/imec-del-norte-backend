import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NotificationsService } from '../notifications.service';
import { NotificationType } from '../enums/notification-types.enum';

interface StockBelowMinEvent {
  insumoId: number;
  nombre: string;
  cantidadActual: number;
  stockMin: number;
}

@Injectable()
export class InventoryNotificationsListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  @OnEvent('stock.below-min')
  async handleStockBelowMin(payload: StockBelowMinEvent) {
    // Por ahora: notificar a todos los Administradores
    const admins = await this.usersRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('role.nombreRol IN (:rol)', { rol: ['Administrador', 'Secretaria'] })
      .andWhere('user.activo = true')
      .getMany();

    const msg = `El insumo "${payload.nombre}" tiene stock bajo: ${payload.cantidadActual} (mínimo ${payload.stockMin}).`;

    const notificaciones = admins.map((admin) =>
      this.notificationsService.createAndSend({
        usuarioId: admin.usuarioId,
        tipo: NotificationType.STOCK_BELOW_MIN,
        titulo: 'Insumo bajo mínimo',
        mensaje: msg,
        data: payload,
      }),
    );

    await Promise.all(notificaciones);
  }
}