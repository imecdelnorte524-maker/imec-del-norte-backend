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
import { AcInspection } from './entities/ac-inspection.entity';
import { Service } from '../services/entities/service.entity';
import { User } from '../users/entities/user.entity';
import { Supply } from '../supplies/entities/supply.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Client } from '../client/entities/client.entity';
import { Equipment } from '../equipment/entities/equipment.entity';
import { Image } from '../images/entities/image.entity';
import { PdfModule } from '../pdf/pdf.module';
import { MaintenanceSchedulerService } from './maintenance-scheduler.service';
import { PlanMantenimiento } from '../equipment/entities/plan-mantenimiento.entity';
import { WorkOrderMaintenancePlan } from './entities/work-order-maintenance-plan.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { ImagesModule } from '../images/images.module';
import { MailModule } from '../mail/mail.module';

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
      AcInspection,
      Service,
      User,
      Supply,
      Tool,
      Inventory,
      Client,
      Equipment,
      Image,
      PlanMantenimiento,
      WorkOrderMaintenancePlan,
    ]),
    PdfModule,
    ImagesModule,
    MailModule,
    RealtimeModule,
  ],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService, MaintenanceSchedulerService],
  exports: [WorkOrdersService, MaintenanceSchedulerService],
})
export class WorkOrdersModule {}
