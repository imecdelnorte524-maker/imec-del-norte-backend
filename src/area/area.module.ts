// src/area/area.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaController } from './area.controller';
import { AreaService } from './area.service';
import { Area } from './entities/area.entity';
import { Client } from '../client/entities/client.entity';
import { SubArea } from '../sub-area/entities/sub-area.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Area, Client, SubArea])],
  controllers: [AreaController],
  providers: [AreaService],
  exports: [AreaService],
})
export class AreaModule {}