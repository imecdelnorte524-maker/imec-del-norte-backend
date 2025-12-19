import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolService } from './tool.service';
import { ToolController } from './tool.controller';
import { Tool } from './entities/tool.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { ImagesModule } from '../images/images.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tool, Inventory]),
    ImagesModule,
  ],
  controllers: [ToolController],
  providers: [ToolService],
  exports: [ToolService],
})
export class ToolModule {}