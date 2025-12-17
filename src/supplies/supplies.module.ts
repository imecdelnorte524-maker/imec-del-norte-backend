import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuppliesService } from './supplies.service';
import { SuppliesController } from './supplies.controller';
import { Supply } from './entities/supply.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { ImagesModule } from '../images/images.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supply, Inventory]),
    ImagesModule,
  ],
  controllers: [SuppliesController],
  providers: [SuppliesService],
  exports: [SuppliesService],
})
export class SuppliesModule {}