import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipment } from './entities/equipment.entity';
import { EquipmentPhoto } from './entities/equipment-photo.entity';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { Client } from '../client/entities/client.entity';
import { Area } from '../area/entities/area.entity';
import { SubArea } from '../sub-area/entities/sub-area.entity';
import { AddEquipmentPhotoDto } from './dto/add-equipment-photo.dto';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
    @InjectRepository(EquipmentPhoto)
    private readonly equipmentPhotoRepository: Repository<EquipmentPhoto>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Area)
    private readonly areaRepository: Repository<Area>,
    @InjectRepository(SubArea)
    private readonly subAreaRepository: Repository<SubArea>,
  ) {}

  /**
   * Prefijo según la categoría del equipo.
   */
  private getCategoryPrefix(category: string): string {
    const normalized = (category || '').toLowerCase();

    if (normalized.includes('aire')) return 'AA';
    if (normalized.includes('incend')) return 'RCI';
    if (normalized.includes('eléct') || normalized.includes('elect')) return 'RE';
    if (normalized.includes('obra')) return 'OC';

    // Prefijo genérico si no coincide
    return 'EQ';
  }

  /**
   * Iniciales de la empresa (cliente).
   * Ej: "Ceramica Italia" -> "CI"
   * Ignora palabras comunes como "de", "del", "la", "el"
   */
  private getClientInitials(clientName: string): string {
    if (!clientName) return 'XX';

    const ignore = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y']);
    const words = clientName
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0 && !ignore.has(w.toLowerCase()));

    if (words.length === 0) return 'XX';

    // Tomamos máximo 2 primeras letras significativas
    const initials = words
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');

    return initials || 'XX';
  }

  /**
   * Genera el siguiente código interno para un equipo:
   * PREFIJO_CATEGORÍA + INICIALES_EMPRESA + NÚMERO (001, 002, 003,...)
   * Ej: AACI001, RCICI001, RECI001, OCCI001
   */
  private async generateEquipmentCode(
    client: Client,
    category: string,
  ): Promise<string> {
    const catPrefix = this.getCategoryPrefix(category);
    const clientInitials = this.getClientInitials(client.nombre);
    const basePrefix = `${catPrefix}${clientInitials}`; // ej: AACI

    // Buscar el último código que comience con ese prefijo
    const last = await this.equipmentRepository
      .createQueryBuilder('equipment')
      .select('equipment.code', 'code')
      .where('equipment.code LIKE :prefix', { prefix: `${basePrefix}%` })
      .orderBy('equipment.code', 'DESC')
      .limit(1)
      .getRawOne<{ code?: string }>();

    let nextNumber = 1;

    if (last?.code) {
      const suffix = last.code.substring(basePrefix.length); // ej: "001"
      const parsed = parseInt(suffix, 10);
      if (!isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }

    const numberPart = nextNumber.toString().padStart(3, '0');
    return `${basePrefix}${numberPart}`;
  }

  /**
   * Crear un equipo (hoja de vida)
   * - Valida que existan client / area / subArea
   * - Genera código interno automáticamente
   * - Guarda usando IDs y código generado
   * - Devuelve el equipo recargado con relaciones
   */
  async create(createEquipmentDto: CreateEquipmentDto): Promise<Equipment> {
    // Validar cliente
    const client = await this.clientRepository.findOne({
      where: { idCliente: createEquipmentDto.clientId },
    });

    if (!client) {
      throw new NotFoundException(
        `Cliente con ID ${createEquipmentDto.clientId} no encontrado`,
      );
    }

    // Validar área si viene
    if (createEquipmentDto.areaId) {
      const area = await this.areaRepository.findOne({
        where: { idArea: createEquipmentDto.areaId },
      });
      if (!area) {
        throw new NotFoundException(
          `Área con ID ${createEquipmentDto.areaId} no encontrada`,
        );
      }
    }

    // Validar subárea si viene
    if (createEquipmentDto.subAreaId) {
      const subArea = await this.subAreaRepository.findOne({
        where: { idSubArea: createEquipmentDto.subAreaId },
      });
      if (!subArea) {
        throw new NotFoundException(
          `Subárea con ID ${createEquipmentDto.subAreaId} no encontrada`,
        );
      }
    }

    // Generar código interno (ignoramos cualquier code que venga en DTO)
    const generatedCode = await this.generateEquipmentCode(
      client,
      createEquipmentDto.category,
    );

    const equipment = this.equipmentRepository.create({
      ...createEquipmentDto,
      code: generatedCode,
    });

    const saved = await this.equipmentRepository.save(equipment);

    // Recargar con relaciones (client, area, subArea, photos)
    return this.findOne(saved.equipmentId);
  }

  /**
   * Listar equipos, con filtros opcionales.
   */
  async findAll(params?: {
    clientId?: number;
    areaId?: number;
    subAreaId?: number;
    search?: string;
  }): Promise<Equipment[]> {
    const query = this.equipmentRepository
      .createQueryBuilder('equipment')
      .leftJoinAndSelect('equipment.client', 'client')
      .leftJoinAndSelect('equipment.area', 'area')
      .leftJoinAndSelect('equipment.subArea', 'subArea')
      .leftJoinAndSelect('equipment.photos', 'photos')
      .orderBy('equipment.createdAt', 'DESC');

    if (params?.clientId) {
      query.andWhere('equipment.clientId = :clientId', {
        clientId: params.clientId,
      });
    }

    if (params?.areaId) {
      query.andWhere('equipment.areaId = :areaId', { areaId: params.areaId });
    }

    if (params?.subAreaId) {
      query.andWhere('equipment.subAreaId = :subAreaId', {
        subAreaId: params.subAreaId,
      });
    }

    if (params?.search) {
      query.andWhere(
        '(equipment.nombre_equipo ILIKE :search OR equipment.codigo_equipo ILIKE :search)',
        { search: `%${params.search}%` },
      );
    }

    return await query.getMany();
  }

  /**
   * Obtener un equipo por ID, con relaciones.
   */
  async findOne(id: number): Promise<Equipment> {
    const equipment = await this.equipmentRepository.findOne({
      where: { equipmentId: id },
      relations: ['client', 'area', 'subArea', 'photos'],
    });

    if (!equipment) {
      throw new NotFoundException(`Equipo con ID ${id} no encontrado`);
    }

    return equipment;
  }

  /**
   * Actualizar equipo.
   * - Valida nuevos clientId / areaId / subAreaId si vienen.
   * - NO cambia el código interno (code) automáticamente.
   * - Guarda y recarga con relaciones.
   */
  async update(
    id: number,
    updateEquipmentDto: UpdateEquipmentDto,
  ): Promise<Equipment> {
    const equipment = await this.findOne(id);

    if (updateEquipmentDto.clientId) {
      const client = await this.clientRepository.findOne({
        where: { idCliente: updateEquipmentDto.clientId },
      });
      if (!client) {
        throw new NotFoundException(
          `Cliente con ID ${updateEquipmentDto.clientId} no encontrado`,
        );
      }
    }

    if (updateEquipmentDto.areaId) {
      const area = await this.areaRepository.findOne({
        where: { idArea: updateEquipmentDto.areaId },
      });
      if (!area) {
        throw new NotFoundException(
          `Área con ID ${updateEquipmentDto.areaId} no encontrada`,
        );
      }
    }

    if (updateEquipmentDto.subAreaId) {
      const subArea = await this.subAreaRepository.findOne({
        where: { idSubArea: updateEquipmentDto.subAreaId },
      });
      if (!subArea) {
        throw new NotFoundException(
          `Subárea con ID ${updateEquipmentDto.subAreaId} no encontrada`,
        );
      }
    }

    // No regeneramos el código en update; si quieres que nunca se cambie, ignoramos updateEquipmentDto.code
    if ('code' in updateEquipmentDto) {
      delete (updateEquipmentDto as any).code;
    }

    Object.assign(equipment, updateEquipmentDto);
    await this.equipmentRepository.save(equipment);

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const equipment = await this.findOne(id);
    await this.equipmentRepository.remove(equipment);
  }

  async addPhoto(
    equipmentId: number,
    addEquipmentPhotoDto: AddEquipmentPhotoDto,
  ): Promise<EquipmentPhoto> {
    const equipment = await this.findOne(equipmentId);

    if (!equipment) {
      throw new NotFoundException(`Equipo con ID ${equipmentId} no encontrado`);
    }

    const photo = this.equipmentPhotoRepository.create({
      equipmentId,
      url: addEquipmentPhotoDto.url,
      description: addEquipmentPhotoDto.description,
    });

    return await this.equipmentPhotoRepository.save(photo);
  }

  async removePhoto(equipmentId: number, photoId: number): Promise<void> {
    const photo = await this.equipmentPhotoRepository.findOne({
      where: { photoId, equipmentId },
    });

    if (!photo) {
      throw new NotFoundException('Foto de equipo no encontrada');
    }

    await this.equipmentPhotoRepository.remove(photo);
  }
}