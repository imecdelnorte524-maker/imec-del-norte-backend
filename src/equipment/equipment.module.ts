import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { Equipment } from './entities/equipment.entity';
import { Client } from '../client/entities/client.entity';
import { Area } from '../area/entities/area.entity';
import { SubArea } from '../sub-area/entities/sub-area.entity';
import { ImagesModule } from '../images/images.module';
import { WorkOrder } from '../work-orders/entities/work-order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Equipment, Client, Area, SubArea, WorkOrder]),
    ImagesModule,
  ],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService, TypeOrmModule],
})
export class EquipmentModule {}