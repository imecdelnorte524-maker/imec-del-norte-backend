// src/technicians/technicians.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TechnicianRankingService } from './technician-ranking.service';
import { TechnicianRankingController } from './technician-ranking.controller';
import { TechnicianRankingHistory } from './entities/technician-ranking-history.entity';
import { WorkOrderTechnician } from '../work-orders/entities/work-order-technician.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TechnicianRankingHistory,
      WorkOrderTechnician,
      WorkOrder,
      User,
    ]),
  ],
  controllers: [TechnicianRankingController],
  providers: [TechnicianRankingService],
  exports: [TechnicianRankingService],
})
export class TechniciansModule {}
