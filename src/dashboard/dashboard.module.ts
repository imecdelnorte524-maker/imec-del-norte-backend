// src/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { WorkOrdersModule } from '../work-orders/work-orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkOrder]),
    WorkOrdersModule, 
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}