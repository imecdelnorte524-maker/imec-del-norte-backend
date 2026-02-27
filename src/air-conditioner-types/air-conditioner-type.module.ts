import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AirConditionerType } from './entities/air-conditioner-type.entity';
import { AirConditionerTypesService } from './air-conditioner-type.service';
import { AirConditionerTypesController } from './air-conditioner-type.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AirConditionerType]),
    NotificationsModule,
  ],
  controllers: [AirConditionerTypesController],
  providers: [AirConditionerTypesService],
  exports: [AirConditionerTypesService],
})
export class AirConditionerTypesModule {}
