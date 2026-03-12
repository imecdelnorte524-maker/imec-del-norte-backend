// src/warehouses/warehouses.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarehousesService } from './warehouses.service';
import { WarehousesController } from './warehouses.controller';
import { Warehouse } from './entities/warehouse.entity';
import { Client } from '../client/entities/client.entity'; // Importar Client
import { RealtimeModule } from '../realtime/realtime.module';
 

@Module({
  imports: [TypeOrmModule.forFeature([Warehouse, Client]), RealtimeModule], // Agregar Client aquí
  controllers: [WarehousesController],
  providers: [WarehousesService],
  exports: [WarehousesService, TypeOrmModule],
})
export class WarehousesModule {}
