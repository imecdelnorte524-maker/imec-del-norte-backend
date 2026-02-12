import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { Equipment } from './entities/equipment.entity';
import { Client } from '../client/entities/client.entity';
import { Area } from '../area/entities/area.entity';
import { SubArea } from '../sub-area/entities/sub-area.entity';
import { ImagesModule } from '../images/images.module';
import { AirConditionerType } from '../air-conditioner-types/entities/air-conditioner-type.entity';
import { EquipmentMotor } from './entities/motor.entity';
import { EquipmentEvaporator } from './entities/evaporator.entity';
import { EquipmentCondenser } from './entities/condenser.entity';
import { EquipmentCompressor } from './entities/compressor.entity';
import { PlanMantenimiento } from './entities/plan-mantenimiento.entity';
import { WorkOrdersModule } from 'src/work-orders/work-orders.module';

import { EquipmentDocumentsService } from './equipment-documents.service';
import { EquipmentDocumentsController } from './equipment-documents.controller';
import { EquipmentDocument } from './entities/equipment-document.entity';

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
    ]),
    ImagesModule,
    WorkOrdersModule,
  ],
  controllers: [EquipmentController, EquipmentDocumentsController],
  providers: [EquipmentService, EquipmentDocumentsService],
  exports: [EquipmentService, TypeOrmModule],
})
export class EquipmentModule {}