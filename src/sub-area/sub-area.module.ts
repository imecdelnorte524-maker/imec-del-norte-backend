// src/sub-area/sub-area.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubAreaController } from './sub-area.controller';
import { SubAreaService } from './sub-area.service';
import { SubArea } from './entities/sub-area.entity';
import { Area } from '../area/entities/area.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SubArea, Area])],
  controllers: [SubAreaController],
  providers: [SubAreaService],
  exports: [SubAreaService],
})
export class SubAreaModule {}