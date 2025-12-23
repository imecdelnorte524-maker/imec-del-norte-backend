// src/equipment/equipment.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipment } from './entities/equipment.entity';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { Client } from '../client/entities/client.entity';
import { Area } from '../area/entities/area.entity';
import { SubArea } from '../sub-area/entities/sub-area.entity';
import { ImagesService } from '../images/images.service';
import { WorkOrder } from '../work-orders/entities/work-order.entity';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Area)
    private readonly areaRepository: Repository<Area>,
    @InjectRepository(SubArea)
    private readonly subAreaRepository: Repository<SubArea>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    private readonly imagesService: ImagesService,
  ) {}

  // ==== helpers de código interno (sin cambios estructurales) ====

  private getCategoryPrefix(category: string): string {
    const normalized = (category || '').toLowerCase();

    if (normalized.includes('aire')) return 'AA';
    if (normalized.includes('incend')) return 'RCI';
    if (normalized.includes('eléct') || normalized.includes('elect'))
      return 'RE';
    if (normalized.includes('obra')) return 'OC';

    return 'EQ';
  }

  private getClientInitials(clientName: string): string {
    if (!clientName) return 'XX';

    const ignore = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y']);
    const words = clientName
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0 && !ignore.has(w.toLowerCase()));

    if (words.length === 0) return 'XX';

    const initials = words
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');

    return initials || 'XX';
  }

  private async generateEquipmentCode(
    client: Client,
    category: string,
  ): Promise<string> {
    const catPrefix = this.getCategoryPrefix(category);
    const clientInitials = this.getClientInitials(client.nombre);
    const basePrefix = `${catPrefix}${clientInitials}`;

    const last = await this.equipmentRepository
      .createQueryBuilder('equipment')
      .select('equipment.code', 'code')
      .where('equipment.code LIKE :prefix', { prefix: `${basePrefix}%` })
      .orderBy('equipment.code', 'DESC')
      .limit(1)
      .getRawOne<{ code?: string }>();

    let nextNumber = 1;

    if (last?.code) {
      const suffix = last.code.substring(basePrefix.length);
      const parsed = parseInt(suffix, 10);
      if (!isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }

    const numberPart = nextNumber.toString().padStart(3, '0');
    return `${basePrefix}${numberPart}`;
  }

  // ==== CRUD ====

  async create(createEquipmentDto: CreateEquipmentDto): Promise<Equipment> {
    const client = await this.clientRepository.findOne({
      where: { idCliente: createEquipmentDto.clientId },
    });

    if (!client) {
      throw new NotFoundException(
        `Cliente con ID ${createEquipmentDto.clientId} no encontrado`,
      );
    }

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

    // ✅ Si se envía una orden de trabajo, validarla y asociarla lógicamente
    if (createEquipmentDto.workOrderId) {
      const workOrder = await this.workOrderRepository.findOne({
        where: { ordenId: createEquipmentDto.workOrderId },
      });

      if (!workOrder) {
        throw new NotFoundException(
          `Orden de trabajo con ID ${createEquipmentDto.workOrderId} no encontrada`,
        );
      }

      // Opcional: validar que la orden pertenece a la misma empresa (cliente)
      if (
        workOrder.clienteEmpresaId &&
        workOrder.clienteEmpresaId !== createEquipmentDto.clientId
      ) {
        throw new BadRequestException(
          'La orden de trabajo no pertenece a la misma empresa (cliente) del equipo',
        );
      }
    }

    const generatedCode = await this.generateEquipmentCode(
      client,
      createEquipmentDto.category,
    );

    // 👇 Aquí no pasamos null explícito, solo dejamos que workOrderId viaje desde el DTO
    const equipment = this.equipmentRepository.create({
      ...createEquipmentDto,
      code: generatedCode,
    });

    const saved = await this.equipmentRepository.save(equipment);
    return this.findOne(saved.equipmentId);
  }

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
      .leftJoinAndSelect('equipment.images', 'images')
      .leftJoinAndSelect('equipment.workOrder', 'workOrder')
      .orderBy('equipment.createdAt', 'DESC');

    if (params?.clientId) {
      query.andWhere('equipment.clientId = :clientId', {
        clientId: params.clientId,
      });
    }

    if (params?.areaId) {
      query.andWhere('equipment.areaId = :areaId', {
        areaId: params.areaId,
      });
    }

    if (params?.subAreaId) {
      query.andWhere('equipment.subAreaId = :subAreaId', {
        subAreaId: params.subAreaId,
      });
    }

    if (params?.search) {
      query.andWhere(
        `(equipment.nombre_equipo ILIKE :search 
       OR equipment.codigo_equipo ILIKE :search)`,
        { search: `%${params.search}%` },
      );
    }

    return query.getMany();
  }

  async findOne(id: number): Promise<Equipment> {
    const equipment = await this.equipmentRepository.findOne({
      where: { equipmentId: id },
      relations: ['client', 'area', 'subArea', 'images', 'workOrder'],
    });

    if (!equipment) {
      throw new NotFoundException(`Equipo con ID ${id} no encontrado`);
    }

    return equipment;
  }

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

    // No permitir cambiar el código manualmente
    if ('code' in updateEquipmentDto) {
      delete (updateEquipmentDto as any).code;
    }

    Object.assign(equipment, updateEquipmentDto);
    await this.equipmentRepository.save(equipment);

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    // Eliminar imágenes Cloudinary + tabla images asociadas a este equipo
    await this.imagesService.deleteByEquipment(id);

    // Borrar equipo
    const equipment = await this.findOne(id);
    await this.equipmentRepository.remove(equipment);
  }
}