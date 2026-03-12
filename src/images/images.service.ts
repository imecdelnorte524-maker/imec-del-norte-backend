import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Image } from './entities/image.entity';
import { CloudinaryService } from './cloudinary.service';
import { Tool } from '../tools/entities/tool.entity';
import { Supply } from '../supplies/entities/supply.entity';
import { User } from '../users/entities/user.entity';
import { Equipment } from '../equipment/entities/equipment.entity';
import { Client } from '../client/entities/client.entity';
import { WorkOrder } from 'src/work-orders/entities/work-order.entity';
import { WorkOrderEvidencePhase, WorkOrderStatus } from 'src/shared/index';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    @InjectRepository(Image)
    private readonly imageRepo: Repository<Image>,

    @InjectRepository(Tool)
    private readonly toolRepo: Repository<Tool>,

    @InjectRepository(Supply)
    private readonly supplyRepo: Repository<Supply>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(WorkOrder)
    private readonly workOrderRepo: Repository<WorkOrder>,

    private readonly cloudinary: CloudinaryService,

    private readonly realtime: RealtimeService,
  ) {}

  // =======================
  //   HERRAMIENTAS - MÚLTIPLES IMÁGENES
  // =======================
  async uploadForTool(toolId: number, files: Express.Multer.File[]) {
    const tool = await this.toolRepo.findOne({
      where: { herramientaId: toolId },
    });

    if (!tool) {
      throw new NotFoundException('Herramienta no encontrada');
    }

    if (!files || files.length === 0) {
      throw new NotFoundException('No se han subido archivos');
    }

    // BORRAR IMÁGENES ANTERIORES
    const existingImages = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.tool_id = :id', { id: toolId })
      .getMany();

    if (existingImages.length) {
      await Promise.all(
        existingImages.map((img) => this.cloudinary.delete(img.public_id)),
      );
      await this.imageRepo.remove(existingImages);
    }

    // Subir todas las imágenes
    const uploadPromises = files.map((file, index) =>
      this.cloudinary.upload(file, `tools/${toolId}/${Date.now()}_${index}`),
    );

    const uploadResults = await Promise.all(uploadPromises);

    // Crear entidades para cada imagen
    const imageEntities = uploadResults.map((upload) =>
      this.imageRepo.create({
        url: upload.secure_url,
        public_id: upload.public_id,
        folder: 'tools',
        tool,
      }),
    );

    const savedImages = await this.imageRepo.save(imageEntities);

    // Evento WebSocket
    this.realtime.emitEntityDetail('tool', toolId, 'updated', {
      images: savedImages,
    });

    return {
      message: `${files.length} imagen(es) subida(s) correctamente para la herramienta`,
      data: savedImages,
    };
  }

  async getToolImages(toolId: number) {
    const tool = await this.toolRepo.findOne({
      where: { herramientaId: toolId },
    });

    if (!tool) {
      throw new NotFoundException('Herramienta no encontrada');
    }

    const images = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.tool_id = :id', { id: toolId })
      .orderBy('image.created_at', 'DESC')
      .getMany();

    return images;
  }

  async deleteByTool(tool: Tool) {
    const images = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.tool_id = :id', { id: tool.herramientaId })
      .getMany();

    if (!images.length) return;

    await Promise.all(
      images.map((img) => this.cloudinary.delete(img.public_id)),
    );
    await this.imageRepo.remove(images);

    this.realtime.emitEntityDetail('tool', tool.herramientaId, 'updated', {
      images: [],
    });
  }

  // =======================
  //   INSUMOS - MÚLTIPLES IMÁGENES
  // =======================
  async uploadForSupply(supplyId: number, files: Express.Multer.File[]) {
    const supply = await this.supplyRepo.findOne({
      where: { insumoId: supplyId },
    });

    if (!supply) {
      throw new NotFoundException('Insumo no encontrado');
    }

    if (!files || files.length === 0) {
      throw new NotFoundException('No se han subido archivos');
    }

    // BORRAR IMÁGENES ANTERIORES
    const existingImages = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.supply_id = :id', { id: supplyId })
      .getMany();

    if (existingImages.length) {
      await Promise.all(
        existingImages.map((img) => this.cloudinary.delete(img.public_id)),
      );
      await this.imageRepo.remove(existingImages);
    }

    // Subir todas las imágenes
    const uploadPromises = files.map((file, index) =>
      this.cloudinary.upload(
        file,
        `supplies/${supplyId}/${Date.now()}_${index}`,
      ),
    );

    const uploadResults = await Promise.all(uploadPromises);

    // Crear entidades para cada imagen
    const imageEntities = uploadResults.map((upload) =>
      this.imageRepo.create({
        url: upload.secure_url,
        public_id: upload.public_id,
        folder: 'supplies',
        supply,
      }),
    );

    const savedImages = await this.imageRepo.save(imageEntities);

    this.realtime.emitEntityDetail('supply', supplyId, 'updated', {
      images: savedImages,
    });

    return {
      message: `${files.length} imagen(es) subida(s) correctamente para el insumo`,
      data: savedImages,
    };
  }

  async getSupplyImages(supplyId: number) {
    const supply = await this.supplyRepo.findOne({
      where: { insumoId: supplyId },
    });

    if (!supply) {
      throw new NotFoundException('Insumo no encontrado');
    }

    const images = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.supply_id = :id', { id: supplyId })
      .orderBy('image.created_at', 'DESC')
      .getMany();

    return images;
  }

  async deleteBySupply(supply: Supply) {
    const images = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.supply_id = :id', { id: supply.insumoId })
      .getMany();

    if (!images.length) {
      this.logger.log(
        `Insumo ${supply.insumoId} no tiene imágenes asociadas para eliminar`,
      );
      return;
    }

    await Promise.all(
      images.map((img) => this.cloudinary.delete(img.public_id)),
    );
    await this.imageRepo.remove(images);

    this.realtime.emitEntityDetail('supply', supply.insumoId, 'updated', {
      images: [],
    });
  }

  // =======================
  //   USUARIOS
  // =======================
  async uploadForUser(userId: number, file: Express.Multer.File) {
    const user = await this.userRepo.findOne({
      where: { usuarioId: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const existingImages = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.user_id = :id', { id: userId })
      .getMany();

    if (existingImages.length) {
      await Promise.all(
        existingImages.map((img) => this.cloudinary.delete(img.public_id)),
      );
      await this.imageRepo.remove(existingImages);
    }

    const upload = await this.cloudinary.upload(file, `users/${userId}`);

    const image = this.imageRepo.create({
      url: upload.secure_url,
      public_id: upload.public_id,
      folder: 'users',
      user,
    });

    const saved = await this.imageRepo.save(image);

    // Evento WebSocket
    this.realtime.emitToUser(userId, 'users.profilePhotoUpdated', {
      userId,
      image: saved,
    });

    return saved;
  }

  async deleteUserImages(userId: number) {
    const user = await this.userRepo.findOne({
      where: { usuarioId: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const images = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.user_id = :userId', { userId })
      .getMany();

    if (!images.length) {
      this.logger.log(
        `Usuario ${userId} no tiene imágenes asociadas para eliminar`,
      );
      return { message: 'El usuario no tiene imágenes para eliminar' };
    }

    await Promise.all(
      images.map((img) => this.cloudinary.delete(img.public_id)),
    );
    const ids = images.map((img) => img.id);
    await this.imageRepo.delete(ids);

    // Evento WebSocket
    this.realtime.emitToUser(userId, 'users.profilePhotoUpdated', {
      userId,
      image: null,
    });

    return { message: 'Fotos de usuario eliminadas correctamente' };
  }

  async getUserProfilePhoto(userId: number) {
    const user = await this.userRepo.findOne({
      where: { usuarioId: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const image = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.user_id = :userId', { userId })
      .orderBy('image.created_at', 'DESC')
      .getOne();

    return image ?? null;
  }

  // =======================
  //   EQUIPOS
  // =======================
  async uploadForEquipment(equipmentId: number, file: Express.Multer.File) {
    const equipment = await this.equipmentRepo.findOne({
      where: { equipmentId },
    });

    if (!equipment) {
      throw new NotFoundException('Equipo no encontrado');
    }

    const upload = await this.cloudinary.upload(
      file,
      `equipment/${equipmentId}`,
    );

    const image = this.imageRepo.create({
      url: upload.secure_url,
      public_id: upload.public_id,
      folder: 'equipment',
      equipment,
    });

    const saved = await this.imageRepo.save(image);
    const images = await this.getEquipmentImages(equipmentId);

    // Evento WebSocket
    this.realtime.emitEntityDetail('equipment', equipmentId, 'updated', {
      images,
    });

    return saved;
  }

  async getEquipmentImages(equipmentId: number) {
    const equipment = await this.equipmentRepo.findOne({
      where: { equipmentId },
    });

    if (!equipment) {
      throw new NotFoundException('Equipo no encontrado');
    }

    const images = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.equipment_id = :id', { id: equipmentId })
      .andWhere('image.folder = :folder', { folder: 'equipment' })
      .andWhere('image.work_order_id IS NULL')
      .orderBy('image.created_at', 'DESC')
      .getMany();

    return images;
  }

  async deleteByEquipment(equipmentId: number) {
    const images = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.equipment_id = :id', { id: equipmentId })
      .andWhere('image.folder = :folder', { folder: 'equipment' })
      .andWhere('image.work_order_id IS NULL')
      .getMany();

    if (!images.length) return;

    await Promise.all(
      images.map((img) => this.cloudinary.delete(img.public_id)),
    );
    await this.imageRepo.remove(images);

    this.realtime.emitEntityDetail('equipment', equipmentId, 'updated', {
      images: [],
    });
  }

  // =======================
  //   CLIENTES
  // =======================
  async uploadClientLogo(clientId: number, file: Express.Multer.File) {
    const client = await this.clientRepo.findOne({
      where: { idCliente: clientId },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Borrar logos anteriores de este cliente
    const existingLogos = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.client_id = :id', { id: clientId })
      .andWhere('image.is_logo = :isLogo', { isLogo: true })
      .getMany();

    if (existingLogos.length) {
      await Promise.all(
        existingLogos.map((img) => this.cloudinary.delete(img.public_id)),
      );
      await this.imageRepo.remove(existingLogos);
    }

    const upload = await this.cloudinary.upload(
      file,
      `clients/${clientId}/logo`,
    );

    const image = this.imageRepo.create({
      url: upload.secure_url,
      public_id: upload.public_id,
      folder: 'clients',
      isLogo: true,
      client,
    });

    const saved = await this.imageRepo.save(image);

    // Evento WebSocket
    this.realtime.emitEntityDetail('client', clientId, 'updated', {
      logo: saved,
    });

    return saved;
  }

  async uploadClientImages(clientId: number, files: Express.Multer.File[]) {
    const client = await this.clientRepo.findOne({
      where: { idCliente: clientId },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    if (!files || files.length === 0) {
      throw new NotFoundException('No se han subido archivos');
    }

    // Subir todas las imágenes
    const uploadPromises = files.map((file, index) =>
      this.cloudinary.upload(
        file,
        `clients/${clientId}/gallery/${Date.now()}_${index}`,
      ),
    );

    const uploadResults = await Promise.all(uploadPromises);

    // Crear entidades para cada imagen
    const imageEntities = uploadResults.map((upload) =>
      this.imageRepo.create({
        url: upload.secure_url,
        public_id: upload.public_id,
        folder: 'clients',
        isLogo: false,
        client,
      }),
    );

    const savedImages = await this.imageRepo.save(imageEntities);

    // Evento WebSocket
    this.realtime.emitEntityDetail('client', clientId, 'updated', {
      gallery: savedImages,
    });

    return {
      message: `${files.length} imagen(es) subida(s) correctamente a la galería del cliente`,
      data: savedImages,
    };
  }

  async getClientImages(clientId: number) {
    const client = await this.clientRepo.findOne({
      where: { idCliente: clientId },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const images = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.client_id = :id', { id: clientId })
      .andWhere('(image.is_logo = :isLogoFalse OR image.is_logo IS NULL)', {
        isLogoFalse: false,
      })
      .orderBy('image.created_at', 'DESC')
      .getMany();

    return images;
  }

  async getClientLogo(clientId: number) {
    const client = await this.clientRepo.findOne({
      where: { idCliente: clientId },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const logo = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.client_id = :id', { id: clientId })
      .andWhere('image.is_logo = :isLogo', { isLogo: true })
      .orderBy('image.created_at', 'DESC')
      .getOne();

    return logo ?? null;
  }

  async deleteByClient(clientId: number) {
    const images = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.client_id = :id', { id: clientId })
      .getMany();

    if (!images.length) return;

    await Promise.all(
      images.map((img) => this.cloudinary.delete(img.public_id)),
    );
    await this.imageRepo.remove(images);

    // Evento WebSocket
    this.realtime.emitEntityDetail('client', clientId, 'updated', {
      gallery: [],
      logo: null,
    });
  }

  // =======================
  //   GENÉRICO POR ID
  // =======================
  async deleteImage(imageId: number) {
    const image = await this.imageRepo.findOne({ where: { id: imageId } });

    if (!image) throw new NotFoundException('Imagen no encontrada');

    const imageCopy = { ...image };

    await this.cloudinary.delete(image.public_id);
    await this.imageRepo.remove(image);

    // Evento WebSocket genérico
    this.realtime.emitGlobal('images.deleted', imageCopy);

    return { message: 'Imagen eliminada correctamente' };
  }

  async uploadForWorkOrder(
    ordenId: number,
    files: Express.Multer.File[],
    phase?: WorkOrderEvidencePhase,
    observation?: string,
    equipmentId?: number,
  ) {
    const workOrder = await this.workOrderRepo.findOne({
      where: { ordenId },
      relations: ['service', 'equipmentWorkOrders'],
    });

    if (!workOrder) {
      throw new NotFoundException('Orden de trabajo no encontrada');
    }

    if (
      workOrder.estado === WorkOrderStatus.COMPLETED ||
      workOrder.estado === WorkOrderStatus.CANCELED
    ) {
      throw new BadRequestException(
        'No se pueden subir evidencias a una orden completada o cancelada',
      );
    }

    if (!files || files.length === 0) {
      throw new NotFoundException('No se han subido archivos');
    }

    const effectivePhase = phase || WorkOrderEvidencePhase.DURING;

    // Detectar AC
    const isAC =
      (workOrder.service?.categoriaServicio || '').toLowerCase().trim() ===
      'aires acondicionados';

    const equipmentIdsInOrder = (workOrder.equipmentWorkOrders || []).map(
      (x) => x.equipmentId,
    );

    if (isAC && !equipmentId) {
      throw new BadRequestException(
        'Debe enviar equipmentId para evidencias de órdenes de Aires Acondicionados',
      );
    }

    let equipment: Equipment | null = null;

    if (equipmentId) {
      const eqId = Number(equipmentId);

      if (!equipmentIdsInOrder.includes(eqId)) {
        throw new BadRequestException(
          'El equipo no pertenece a esta orden de trabajo',
        );
      }

      equipment = await this.equipmentRepo.findOne({
        where: { equipmentId: eqId },
      });

      if (!equipment) {
        throw new NotFoundException('Equipo no encontrado');
      }
    }

    const uploadResults = await Promise.all(
      files.map((file, index) =>
        this.cloudinary.upload(
          file,
          `work-orders/${ordenId}/evidence/${Date.now()}_${index}`,
        ),
      ),
    );

    const imageEntities = uploadResults.map((upload) =>
      this.imageRepo.create({
        url: upload.secure_url,
        public_id: upload.public_id,
        folder: 'work-orders',
        workOrder,
        evidencePhase: effectivePhase,
        observation: observation || null,
        equipment: equipment || undefined,
      }),
    );

    const savedImages = await this.imageRepo.save(imageEntities);

    this.realtime.emitEntityDetail('workOrder', ordenId, 'updated', {
      images: await this.getWorkOrderImages(ordenId),
    });

    return {
      message: `${files.length} imagen(es) subida(s) correctamente como evidencia de la orden`,
      data: savedImages,
    };
  }

  async getWorkOrderImages(ordenId: number) {
    const workOrder = await this.workOrderRepo.findOne({
      where: { ordenId },
    });

    if (!workOrder) {
      throw new NotFoundException('Orden de trabajo no encontrada');
    }

    const images = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.work_order_id = :ordenId', { ordenId })
      .orderBy('image.created_at', 'DESC')
      .getMany();

    return images;
  }

  async deleteByWorkOrder(ordenId: number) {
    const workOrder = await this.workOrderRepo.findOne({
      where: { ordenId },
    });

    if (!workOrder) {
      throw new NotFoundException('Orden de trabajo no encontrada');
    }

    const images = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.work_order_id = :ordenId', { ordenId })
      .getMany();

    if (!images.length) return;

    await Promise.all(
      images.map((img) => this.cloudinary.delete(img.public_id)),
    );
    await this.imageRepo.remove(images);

    this.realtime.emitEntityDetail('workOrder', ordenId, 'updated', {
      images: [],
    });
  }
}
