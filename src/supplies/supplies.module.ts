// src/supplies/supplies.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuppliesService } from './supplies.service';
import { SuppliesController } from './supplies.controller';
import { Supply } from './entities/supply.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { UnitMeasure } from '../unit-measure/entities/unit-measure.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { ImagesModule } from '../images/images.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supply, Inventory, UnitMeasure, Warehouse]),
    ImagesModule,
    CommonModule,
    NotificationsModule,
  ],
  controllers: [SuppliesController],
  providers: [SuppliesService],
  exports: [SuppliesService],
})
export class SuppliesModule {}