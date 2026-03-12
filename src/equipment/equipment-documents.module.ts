// src/equipment/equipment-documents.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentDocumentsController } from './equipment-documents.controller';
import { EquipmentDocumentsService } from './equipment-documents.service';
import { EquipmentDocument } from './entities/equipment-document.entity';
import { Equipment } from './entities/equipment.entity';
import { ImagesModule } from '../images/images.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EquipmentDocument, Equipment]),
    ImagesModule,
    RealtimeModule,
  ],
  controllers: [EquipmentDocumentsController],
  providers: [EquipmentDocumentsService],
  exports: [EquipmentDocumentsService],
})
export class EquipmentDocumentsModule {}
