// src/work-orders/work-orders.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrder } from './entities/work-order.entity';
import { SupplyDetail } from './entities/supply-detail.entity';
import { ToolDetail } from './entities/tool-detail.entity';
import { EquipmentWorkOrder } from './entities/equipment-work-order.entity';
import { WorkOrderTechnician } from './entities/work-order-technician.entity';
import { WorkOrderTimer } from './entities/work-order-timer.entity';
import { WorkOrderPause } from './entities/work-order-pause.entity';
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
import { AcInspection } from './entities/ac-inspection.entity';
import { Image } from 'src/images/entities/image.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkOrder,
      SupplyDetail,
      ToolDetail,
      EquipmentWorkOrder,
      WorkOrderTechnician,
      WorkOrderTimer,
      WorkOrderPause,
      Service,
      User,
      Supply,
      Tool,
      Inventory,
      Client,
      Equipment,
      PlanMantenimiento,
      AcInspection,
      Image,
    ]),
    MailModule,
  ],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService, MaintenanceSchedulerService],
  exports: [WorkOrdersService, MaintenanceSchedulerService],
})
export class WorkOrdersModule {}
