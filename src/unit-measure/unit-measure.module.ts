import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitMeasureService } from './unit-measure.service';
import { UnitMeasureController } from './unit-measure.controller';
import { UnitMeasure } from './entities/unit-measure.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([UnitMeasure]), NotificationsModule],
  controllers: [UnitMeasureController],
  providers: [UnitMeasureService],
  exports: [TypeOrmModule, UnitMeasureService],
})
export class UnitMeasureModule {}
