import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { Inventory } from './entities/inventory.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Supply } from '../supplies/entities/supply.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Inventory, Tool, Supply])],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}