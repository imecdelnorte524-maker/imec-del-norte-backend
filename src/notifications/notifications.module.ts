// notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { Client } from '../client/entities/client.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsController } from './notifications.controller';
import { WorkOrdersNotificationsListener } from './listeners/work-orders-notifications.listener';
import { InventoryNotificationsListener } from './listeners/inventory-notifications.listener';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User, Client]),
    ConfigModule,
  ],
  providers: [
    NotificationsService,
    NotificationsGateway,
    WorkOrdersNotificationsListener,
    InventoryNotificationsListener,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}