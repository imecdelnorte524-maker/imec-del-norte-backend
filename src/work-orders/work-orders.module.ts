import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrder } from './entities/work-order.entity';
import { SupplyDetail } from './entities/supply-detail.entity';
import { ToolDetail } from './entities/tool-detail.entity';
import { EquipmentWorkOrder } from './entities/equipment-work-order.entity';
import { Service } from '../services/entities/service.entity';
import { User } from '../users/entities/user.entity';
import { Supply } from '../supplies/entities/supply.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Client } from '../client/entities/client.entity';
import { Equipment } from '../equipment/entities/equipment.entity';
import { PlanMantenimiento } from '../equipment/entities/plan-mantenimiento.entity';
import { MailModule } from '../mail/mail.module';
import { MaintenanceSchedulerService } from './maintenance-scheduler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkOrder,
      SupplyDetail,
      ToolDetail,
      EquipmentWorkOrder,
      Service,
      User,
      Supply,
      Tool,
      Inventory,
      Client,
      Equipment,
      PlanMantenimiento,
    ]),
    MailModule,
  ],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService, MaintenanceSchedulerService],
  exports: [WorkOrdersService, MaintenanceSchedulerService],
})
export class WorkOrdersModule {}