import {
  Injectable,
  NotFoundException,
  Logger,
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

    private readonly cloudinary: CloudinaryService,
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

    // Verificar si hay archivos
    if (!files || files.length === 0) {
      throw new NotFoundException('No se han subido archivos');
    }

    // BORRAR IMÁGENES ANTERIORES (usando FK tool_id)
    const existingImages = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.tool_id = :id', { id: toolId })
      .getMany();

    if (existingImages.length) {
      await Promise.all(
        existingImages.map((img) =>
          this.cloudinary.delete(img.public_id),
        ),
      );
      await this.imageRepo.remove(existingImages);
    }

    // Subir todas las imágenes
    const uploadPromises = files.map((file, index) =>
      this.cloudinary.upload(file, `tools/${toolId}/${Date.now()}_${index}`)
    );

    const uploadResults = await Promise.all(uploadPromises);

    // Crear entidades para cada imagen
    const imageEntities = uploadResults.map(upload => 
      this.imageRepo.create({
        url: upload.secure_url,
        public_id: upload.public_id,
        folder: 'tools',
        tool,
      })
    );

    // Guardar todas las imágenes en la base de datos
    const savedImages = await this.imageRepo.save(imageEntities);

    return {
      message: `${files.length} imagen(es) subida(s) correctamente para la herramienta`,
      data: savedImages,
    };
  }

  async getToolImages(toolId: number) {
    // Verificar que la herramienta exista
    const tool = await this.toolRepo.findOne({
      where: { herramientaId: toolId },
    });

    if (!tool) {
      throw new NotFoundException('Herramienta no encontrada');
    }

    // Buscar imágenes por la columna FK tool_id
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

    this.logger.log(
      `Imágenes de herramienta eliminadas. Herramienta=${tool.herramientaId}, imágenes borradas=${images
        .map((i) => i.id)
        .join(',')}`,
    );
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

    // Verificar si hay archivos
    if (!files || files.length === 0) {
      throw new NotFoundException('No se han subido archivos');
    }

    // BORRAR IMÁGENES ANTERIORES (FK supply_id)
    const existingImages = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.supply_id = :id', { id: supplyId })
      .getMany();

    if (existingImages.length) {
      await Promise.all(
        existingImages.map((img) =>
          this.cloudinary.delete(img.public_id),
        ),
      );
      await this.imageRepo.remove(existingImages);
    }

    // Subir todas las imágenes
    const uploadPromises = files.map((file, index) =>
      this.cloudinary.upload(file, `supplies/${supplyId}/${Date.now()}_${index}`)
    );

    const uploadResults = await Promise.all(uploadPromises);

    // Crear entidades para cada imagen
    const imageEntities = uploadResults.map(upload => 
      this.imageRepo.create({
        url: upload.secure_url,
        public_id: upload.public_id,
        folder: 'supplies',
        supply,
      })
    );

    // Guardar todas las imágenes en la base de datos
    const savedImages = await this.imageRepo.save(imageEntities);

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

    this.logger.log(
      `Imágenes de insumo eliminadas. Insumo=${supply.insumoId}, imágenes borradas=${images
        .map((i) => i.id)
        .join(',')}`,
    );
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
        existingImages.map((img) =>
          this.cloudinary.delete(img.public_id),
        ),
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

    return this.imageRepo.save(image);
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

    this.logger.log(
      `Fotos de usuario eliminadas. Usuario=${userId}, imágenes borradas=${ids.join(
        ',',
      )}`,
    );

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
  async uploadForEquipment(
    equipmentId: number,
    file: Express.Multer.File,
  ) {
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

    return this.imageRepo.save(image);
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
      .orderBy('image.created_at', 'DESC')
      .getMany();

    return images;
  }

  async deleteByEquipment(equipmentId: number) {
    const images = await this.imageRepo
      .createQueryBuilder('image')
      .where('image.equipment_id = :id', { id: equipmentId })
      .getMany();

    if (!images.length) return;

    await Promise.all(
      images.map((img) => this.cloudinary.delete(img.public_id)),
    );
    await this.imageRepo.remove(images);

    this.logger.log(
      `Imágenes de equipo eliminadas. Equipo=${equipmentId}, imágenes borradas=${images
        .map((i) => i.id)
        .join(',')}`,
    );
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
        existingLogos.map((img) =>
          this.cloudinary.delete(img.public_id),
        ),
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

    return this.imageRepo.save(image);
  }

  async uploadClientImages(clientId: number, files: Express.Multer.File[]) {
    const client = await this.clientRepo.findOne({
      where: { idCliente: clientId },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Verificar si hay archivos
    if (!files || files.length === 0) {
      throw new NotFoundException('No se han subido archivos');
    }

    // Subir todas las imágenes
    const uploadPromises = files.map((file, index) =>
      this.cloudinary.upload(file, `clients/${clientId}/gallery/${Date.now()}_${index}`)
    );

    const uploadResults = await Promise.all(uploadPromises);

    // Crear entidades para cada imagen
    const imageEntities = uploadResults.map(upload => 
      this.imageRepo.create({
        url: upload.secure_url,
        public_id: upload.public_id,
        folder: 'clients',
        isLogo: false,
        client,
      })
    );

    // Guardar todas las imágenes en la base de datos
    const savedImages = await this.imageRepo.save(imageEntities);

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

    this.logger.log(
      `Imágenes de cliente eliminadas. Cliente=${clientId}, imágenes borradas=${images
        .map((i) => i.id)
        .join(',')}`,
    );
  }

  // =======================
  //   GENÉRICO POR ID
  // =======================
  async deleteImage(imageId: number) {
    const image = await this.imageRepo.findOne({ where: { id: imageId } });

    if (!image) throw new NotFoundException('Imagen no encontrada');

    await this.cloudinary.delete(image.public_id);
    await this.imageRepo.remove(image);

    return { message: 'Imagen eliminada correctamente' };
  }
}