import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceTypesService } from './maintenance-types.service';
import { MaintenanceTypesController } from './maintenance-types.controller';
import { MaintenanceType } from './entities/maintenance-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceType])],
  controllers: [MaintenanceTypesController],
  providers: [MaintenanceTypesService],
  exports: [MaintenanceTypesService],
})
export class MaintenanceTypesModule {}