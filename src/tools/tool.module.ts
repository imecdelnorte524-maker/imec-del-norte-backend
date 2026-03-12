// src/tools/tools.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolService } from './tool.service';
import { ToolController } from './tool.controller';
import { Tool } from './entities/tool.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { ImagesModule } from '../images/images.module';
import { CommonModule } from '../common/common.module';
import { RealtimeModule } from '../realtime/realtime.module';
 

@Module({
  imports: [
    TypeOrmModule.forFeature([Tool, Inventory, Warehouse]),
    ImagesModule,
    CommonModule,
    RealtimeModule,
  ],
  controllers: [ToolController],
  providers: [ToolService],
  exports: [ToolService],
})
export class ToolsModule {}
