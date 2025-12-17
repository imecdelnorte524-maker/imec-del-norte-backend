import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Image } from './entities/image.entity';
import { CloudinaryService } from './cloudinary.service';
import { Tool } from '../tools/entities/tool.entity';
import { Supply } from '../supplies/entities/supply.entity';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(Image)
    private readonly imageRepo: Repository<Image>,

    @InjectRepository(Tool)
    private readonly toolRepo: Repository<Tool>,

    @InjectRepository(Supply)
    private readonly supplyRepo: Repository<Supply>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly cloudinary: CloudinaryService,
  ) {}

  // =======================
  //   HERRAMIENTAS
  // =======================
  async uploadForTool(toolId: number, file: Express.Multer.File) {
    const tool = await this.toolRepo.findOne({
      where: { herramientaId: toolId },
    });

    if (!tool) {
      throw new NotFoundException('Herramienta no encontrada');
    }

    const upload = await this.cloudinary.upload(file, `tools/${toolId}`);

    const image = this.imageRepo.create({
      url: upload.secure_url,
      publicId: upload.public_id,
      folder: 'tools',
      tool,
    });

    return this.imageRepo.save(image);
  }

  async deleteByTool(tool: Tool) {
    // Buscar todas las imágenes asociadas a esta herramienta
    const images = await this.imageRepo.find({ where: { tool } });
    if (!images.length) return;

    // Primero borrar en Cloudinary
    await Promise.all(
      images.map(img => this.cloudinary.delete(img.publicId)),
    );

    // Luego borrar en BD
    await this.imageRepo.remove(images);
  }

  // =======================
  //   INSUMOS
  // =======================
  async uploadForSupply(supplyId: number, file: Express.Multer.File) {
    const supply = await this.supplyRepo.findOne({
      where: { insumoId: supplyId },
    });

    if (!supply) {
      throw new NotFoundException('Insumo no encontrado');
    }

    const upload = await this.cloudinary.upload(file, `supplies/${supplyId}`);

    const image = this.imageRepo.create({
      url: upload.secure_url,
      publicId: upload.public_id,
      folder: 'supplies',
      supply,
    });

    return this.imageRepo.save(image);
  }

  // Usado por SuppliesService.remove(...)
  async deleteBySupply(supply: Supply) {
    const images = await this.imageRepo.find({ where: { supply } });
    if (!images.length) return;

    await Promise.all(
      images.map(img => this.cloudinary.delete(img.publicId)),
    );
    await this.imageRepo.remove(images);
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

    // Opcional: si quieres que solo haya UNA foto de perfil por usuario,
    // borra primero las anteriores
    const existingImages = await this.imageRepo.find({ where: { user } });
    if (existingImages.length) {
      await Promise.all(
        existingImages.map(img => this.cloudinary.delete(img.publicId)),
      );
      await this.imageRepo.remove(existingImages);
    }

    const upload = await this.cloudinary.upload(file, `users/${userId}`);

    const image = this.imageRepo.create({
      url: upload.secure_url,
      publicId: upload.public_id,
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

    const images = await this.imageRepo.find({ where: { user } });

    if (!images.length) {
      // No lanzo error, simplemente informo que no había imágenes
      return { message: 'El usuario no tiene imágenes para eliminar' };
    }

    await Promise.all(
      images.map(img => this.cloudinary.delete(img.publicId)),
    );
    await this.imageRepo.remove(images);

    return { message: 'Fotos de usuario eliminadas correctamente' };
  }

  // =======================
  //   GENÉRICO POR ID
  // =======================
  async deleteImage(imageId: number) {
    const image = await this.imageRepo.findOne({ where: { id: imageId } });

    if (!image) throw new NotFoundException('Imagen no encontrada');

    await this.cloudinary.delete(image.publicId);
    await this.imageRepo.remove(image);

    return { message: 'Imagen eliminada correctamente' };
  }
}