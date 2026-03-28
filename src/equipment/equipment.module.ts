// src/equipment/equipment.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { Equipment } from './entities/equipment.entity';
import { Client } from '../client/entities/client.entity';
import { Area } from '../area/entities/area.entity';
import { SubArea } from '../sub-area/entities/sub-area.entity';
import { ImagesModule } from '../images/images.module'; // ✅ IMPORTADO
import { AirConditionerType } from '../air-conditioner-types/entities/air-conditioner-type.entity';
import { EquipmentMotor } from './entities/motor.entity';
import { EquipmentEvaporator } from './entities/evaporator.entity';
import { EquipmentCondenser } from './entities/condenser.entity';
import { EquipmentCompressor } from './entities/compressor.entity';
import { PlanMantenimiento } from './entities/plan-mantenimiento.entity';
import { EquipmentDocumentsService } from './equipment-documents.service';
import { EquipmentDocumentsController } from './equipment-documents.controller';
import { EquipmentDocument } from './entities/equipment-document.entity';
import { PdfModule } from '../pdf/pdf.module';
import { User } from '../users/entities/user.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { WorkOrdersModule } from '../work-orders/work-orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Equipment,
      Client,
      Area,
      SubArea,
      AirConditionerType,
      EquipmentMotor,
      EquipmentEvaporator,
      EquipmentCondenser,
      EquipmentCompressor,
      PlanMantenimiento,
      EquipmentDocument,
      User,
    ]),
    ImagesModule,
    WorkOrdersModule,
    RealtimeModule,
    PdfModule,
  ],
  controllers: [EquipmentController, EquipmentDocumentsController],
  providers: [EquipmentService, EquipmentDocumentsService],
  exports: [EquipmentService, TypeOrmModule],
})
export class EquipmentModule {}