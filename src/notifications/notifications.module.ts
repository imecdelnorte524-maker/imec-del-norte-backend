import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsController } from './notifications.controller';
import { WorkOrdersNotificationsListener } from './listeners/work-orders-notifications.listener';
import { InventoryNotificationsListener } from './listeners/inventory-notifications.listener';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
    ConfigModule,
  ],
  providers: [
    NotificationsService,
    NotificationsGateway,
    WorkOrdersNotificationsListener,
    InventoryNotificationsListener,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}