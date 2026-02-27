import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentDocumentsController } from './equipment-documents.controller';
import { EquipmentDocumentsService } from './equipment-documents.service';
import { EquipmentDocument } from './entities/equipment-document.entity';
import { Equipment } from './entities/equipment.entity';
import { CloudinaryService } from '../images/cloudinary.service';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';


@Module({
  imports: [TypeOrmModule.forFeature([EquipmentDocument, Equipment])],
  controllers: [EquipmentDocumentsController],
  providers: [EquipmentDocumentsService, CloudinaryService, NotificationsGateway],
  exports: [EquipmentDocumentsService],
})
export class EquipmentDocumentsModule {}
