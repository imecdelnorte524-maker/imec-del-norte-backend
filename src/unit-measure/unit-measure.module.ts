import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitMeasureService } from './unit-measure.service';
import { UnitMeasureController } from './unit-measure.controller';
import { UnitMeasure } from './entities/unit-measure.entity';
import { RealtimeModule } from '../realtime/realtime.module';
 

@Module({
  imports: [TypeOrmModule.forFeature([UnitMeasure]), RealtimeModule],
  controllers: [UnitMeasureController],
  providers: [UnitMeasureService],
  exports: [TypeOrmModule, UnitMeasureService],
})
export class UnitMeasureModule {}
