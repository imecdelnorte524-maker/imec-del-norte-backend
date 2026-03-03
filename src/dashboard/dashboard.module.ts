// src/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { User } from '../users/entities/user.entity';
import { WorkOrdersModule } from '../work-orders/work-orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkOrder, User]), // 👈 IMPORTANTE: User agregado
    WorkOrdersModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
