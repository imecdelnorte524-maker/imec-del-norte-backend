import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CloudinaryService } from '../images/cloudinary.service';
import { Equipment } from './entities/equipment.entity';
import { EquipmentDocument } from './entities/equipment-document.entity';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';

@Injectable()
export class EquipmentDocumentsService {
  constructor(
    @InjectRepository(EquipmentDocument)
    private readonly docRepo: Repository<EquipmentDocument>,
    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,
    private readonly cloudinary: CloudinaryService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  private ensurePdf(file: Express.Multer.File) {
    const isPdf =
      file?.mimetype === 'application/pdf' ||
      (file?.originalname || '').toLowerCase().endsWith('.pdf');

    if (!isPdf) throw new BadRequestException('Solo se permiten archivos PDF');
  }

  private buildDownloadUrl(cloudinaryUrl: string) {
    const marker = '/upload/';
    const idx = cloudinaryUrl.indexOf(marker);
    if (idx === -1) return cloudinaryUrl;

    return (
      cloudinaryUrl.slice(0, idx + marker.length) +
      'fl_attachment/' +
      cloudinaryUrl.slice(idx + marker.length)
    );
  }

  async listByEquipment(equipmentId: number) {
    const equipment = await this.equipmentRepo.findOne({ where: { equipmentId } });
    if (!equipment) throw new NotFoundException('Equipo no encontrado');

    const docs = await this.docRepo
      .createQueryBuilder('d')
      .leftJoin('d.equipment', 'equipment')
      .where('equipment.equipmentId = :equipmentId', { equipmentId })
      .orderBy('d.created_at', 'DESC')
      .getMany();

    return docs.map((d) => ({
      id: d.id,
      equipmentId,
      originalName: d.original_name,
      mimeType: 'application/pdf',
      size: d.bytes ?? null,
      createdAt: d.created_at,
      url: d.url,
      downloadUrl: this.buildDownloadUrl(d.url),
      publicId: d.public_id,
    }));
  }

  async upload(equipmentId: number, file: Express.Multer.File) {
    const equipment = await this.equipmentRepo.findOne({ where: { equipmentId } });
    if (!equipment) throw new NotFoundException('Equipo no encontrado');
    if (!file) throw new BadRequestException('No se ha subido archivo');

    this.ensurePdf(file);

    const upload = await this.cloudinary.upload(
      file,
      `equipment/${equipmentId}/documents`,
      'raw', // ✅ PDF en Cloudinary = RAW
    );

    if (!upload?.secure_url || !upload?.public_id) {
      throw new InternalServerErrorException('Cloudinary no devolvió secure_url/public_id');
    }

    const doc = this.docRepo.create({
      url: upload.secure_url,
      public_id: upload.public_id,
      folder: `equipment/${equipmentId}/documents`,
      original_name: file.originalname,
      bytes: upload.bytes ?? file.size,
      format: upload.format ?? 'pdf',
      equipment,
    });

    const saved = await this.docRepo.save(doc);

    // websocket
    const docs = await this.listByEquipment(equipmentId);
    this.notificationsGateway.server.emit('equipment.documentsUpdated', {
      equipmentId,
      documents: docs,
    });

    return {
      id: saved.id,
      equipmentId,
      originalName: saved.original_name,
      mimeType: 'application/pdf',
      size: saved.bytes ?? null,
      createdAt: saved.created_at,
      url: saved.url,
      downloadUrl: this.buildDownloadUrl(saved.url),
      publicId: saved.public_id,
    };
  }

  async deleteDocument(docId: number) {
    const doc = await this.docRepo.findOne({
      where: { id: docId },
      relations: ['equipment'],
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    const equipmentId = doc.equipment?.equipmentId;

    await this.cloudinary.delete(doc.public_id, 'raw');
    await this.docRepo.remove(doc);

    if (equipmentId) {
      const docs = await this.listByEquipment(equipmentId);
      this.notificationsGateway.server.emit('equipment.documentsUpdated', {
        equipmentId,
        documents: docs,
      });
    }

    return { message: 'Documento eliminado correctamente' };
  }

  async deleteByEquipment(equipmentId: number) {
    const docs = await this.docRepo
      .createQueryBuilder('d')
      .leftJoin('d.equipment', 'equipment')
      .where('equipment.equipmentId = :equipmentId', { equipmentId })
      .getMany();

    if (!docs.length) return;

    await Promise.all(docs.map((d) => this.cloudinary.delete(d.public_id, 'raw')));
    await this.docRepo.remove(docs);

    this.notificationsGateway.server.emit('equipment.documentsUpdated', {
      equipmentId,
      documents: [],
    });
  }
}