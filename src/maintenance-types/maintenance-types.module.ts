import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceTypesService } from './maintenance-types.service';
import { MaintenanceTypesController } from './maintenance-types.controller';
import { MaintenanceType } from './entities/maintenance-type.entity';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceType]), RealtimeModule],
  controllers: [MaintenanceTypesController],
  providers: [MaintenanceTypesService],
  exports: [MaintenanceTypesService],
})
export class MaintenanceTypesModule {}
