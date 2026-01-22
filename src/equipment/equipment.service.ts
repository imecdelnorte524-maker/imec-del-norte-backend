import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Equipment } from './entities/equipment.entity';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { Client } from '../client/entities/client.entity';
import { Area } from '../area/entities/area.entity';
import { SubArea } from '../sub-area/entities/sub-area.entity';
import { ImagesService } from '../images/images.service';
import { AirConditionerType } from '../air-conditioner-types/entities/air-conditioner-type.entity';
import { ServiceCategory } from '../services/enums/service.enums';
import { EquipmentMotor } from './entities/motor.entity';
import { EquipmentEvaporator } from './entities/evaporator.entity';
import { EquipmentCondenser } from './entities/condenser.entity';
import { EquipmentCompressor } from './entities/compressor.entity';
import { PlanMantenimiento } from './entities/plan-mantenimiento.entity';
import { EquipmentStatus } from './enums/equipment-status.enum';

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
    @InjectRepository(AirConditionerType)
    private readonly acTypeRepository: Repository<AirConditionerType>,
    @InjectRepository(EquipmentMotor)
    private readonly motorRepository: Repository<EquipmentMotor>,
    @InjectRepository(EquipmentEvaporator)
    private readonly evaporatorRepository: Repository<EquipmentEvaporator>,
    @InjectRepository(EquipmentCondenser)
    private readonly condenserRepository: Repository<EquipmentCondenser>,
    @InjectRepository(EquipmentCompressor)
    private readonly compressorRepository: Repository<EquipmentCompressor>,
    @InjectRepository(PlanMantenimiento)
    private readonly planMantenimientoRepository: Repository<PlanMantenimiento>,
    private readonly imagesService: ImagesService,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // Helpers para generación de código
  // ────────────────────────────────────────────────────────────────

  private getClientInitials(clientName: string): string {
    if (!clientName) return 'XX';
    const ignore = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y']);
    const words = clientName
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0 && !ignore.has(w.toLowerCase()));
    if (words.length === 0) return 'XX';
    return words
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  private getCategoryPrefix(category: ServiceCategory): string {
    const prefixes: Record<ServiceCategory, string> = {
      [ServiceCategory.AIRES_ACONDICIONADOS]: 'AA',
      [ServiceCategory.REDES_CONTRA_INCENDIOS]: 'RCI',
      [ServiceCategory.REDES_ELECTRICAS]: 'RE',
      [ServiceCategory.OBRAS_CIVILES]: 'OC',
    };
    return prefixes[category] ?? 'EQ';
  }

  private async getAreaIndex(
    clientId: number,
    areaId: number,
  ): Promise<string> {
    const areas = await this.areaRepository.find({
      where: { clienteId: clientId },
      order: { createdAt: 'ASC' },
    });
    const index = areas.findIndex((a) => a.idArea === areaId);
    if (index === -1)
      throw new BadRequestException('Área no pertenece al cliente');
    return (index + 1).toString().padStart(2, '0');
  }

  private async getSubAreaIndex(subAreaId: number): Promise<string> {
    const subArea = await this.subAreaRepository.findOne({
      where: { idSubArea: subAreaId },
    });
    if (!subArea) throw new BadRequestException('Subárea no encontrada');

    const parentId = subArea.parentSubAreaId ?? null;
    const siblings = await this.subAreaRepository.find({
      where: {
        areaId: subArea.areaId,
        parentSubAreaId: parentId === null ? IsNull() : parentId,
      },
      order: { createdAt: 'ASC' },
    });

    const index = siblings.findIndex((s) => s.idSubArea === subAreaId);
    if (index === -1)
      throw new BadRequestException('Error calculando índice de subárea');
    return (index + 1).toString().padStart(2, '0');
  }

  private async getEquipmentIndexInLocation(
    clientId: number,
    areaId: number,
    subAreaId: number | null,
  ): Promise<string> {
    const where: any = { clientId, areaId };
    if (subAreaId !== null) where.subAreaId = subAreaId;
    else where.subAreaId = IsNull();

    const count = await this.equipmentRepository.count({ where });
    return (count + 1).toString().padStart(2, '0');
  }

  private async generateEquipmentCode(
    client: Client,
    areaId: number,
    subAreaId: number | null | undefined,
    category: ServiceCategory,
  ): Promise<string> {
    const clientInitials = this.getClientInitials(client.nombre);
    const categoryPrefix = this.getCategoryPrefix(category);

    const areaIndex = await this.getAreaIndex(client.idCliente, areaId);

    let subAreasPath = '';
    let current = subAreaId ?? null;
    while (current) {
      const index = await this.getSubAreaIndex(current);
      subAreasPath = index + subAreasPath;
      const sub = await this.subAreaRepository.findOne({
        where: { idSubArea: current },
      });
      current = sub?.parentSubAreaId ?? null;
    }
    if (!subAreasPath) subAreasPath = '00';

    const equipmentIndex = await this.getEquipmentIndexInLocation(
      client.idCliente,
      areaId,
      subAreaId ?? null,
    );

    return `${clientInitials}${categoryPrefix}${areaIndex}${subAreasPath}${equipmentIndex}`;
  }

  // ────────────────────────────────────────────────────────────────
  // CREATE
  // ────────────────────────────────────────────────────────────────

  async create(dto: CreateEquipmentDto): Promise<Equipment> {
    const client = await this.clientRepository.findOne({
      where: { idCliente: dto.clientId },
    });
    if (!client)
      throw new NotFoundException(`Cliente ${dto.clientId} no encontrado`);

    // Validar ubicación
    if (!dto.areaId && !dto.subAreaId) {
      throw new BadRequestException('Debe especificar área o subárea');
    }

    let finalAreaId = dto.areaId;
    let finalSubAreaId = dto.subAreaId ?? null;

    if (finalSubAreaId) {
      const sub = await this.subAreaRepository.findOne({
        where: { idSubArea: finalSubAreaId },
      });
      if (!sub)
        throw new NotFoundException(`Subárea ${finalSubAreaId} no encontrada`);
      if (finalAreaId && finalAreaId !== sub.areaId) {
        throw new BadRequestException('Área no coincide con subárea');
      }
      finalAreaId = sub.areaId;
    } else if (finalAreaId) {
      const area = await this.areaRepository.findOne({
        where: { idArea: finalAreaId },
      });
      if (!area)
        throw new NotFoundException(`Área ${finalAreaId} no encontrada`);
    }

    // Validar categoría y tipo de aire
    if (dto.category === ServiceCategory.AIRES_ACONDICIONADOS) {
      if (!dto.airConditionerTypeId)
        throw new BadRequestException('Tipo de aire requerido');
      const acType = await this.acTypeRepository.findOne({
        where: { id: dto.airConditionerTypeId },
      });
      if (!acType) throw new BadRequestException('Tipo de aire no existe');
    } else if (dto.airConditionerTypeId) {
      throw new BadRequestException(
        'Solo aires acondicionados pueden tener tipo de aire',
      );
    }

    // Generar código
    if (!finalAreaId)
      throw new BadRequestException('Área requerida para generar código');
    const code = await this.generateEquipmentCode(
      client,
      finalAreaId,
      finalSubAreaId,
      dto.category,
    );

    // Crear equipo base
    const equipment = this.equipmentRepository.create({
      ...dto,
      areaId: finalAreaId,
      subAreaId: finalSubAreaId ?? undefined,
      code,
      status: dto.status ?? EquipmentStatus.ACTIVE,
    });

    const saved = await this.equipmentRepository.save(equipment);

    // Crear componentes y plan
    await this.createComponents(saved.equipmentId, dto);

    return this.findOne(saved.equipmentId);
  }

  private async createComponents(
    equipmentId: number,
    dto: CreateEquipmentDto,
  ): Promise<void> {
    // Evaporadores + sus motores
    if (dto.evaporators?.length) {
      for (const evapDto of dto.evaporators) {
        const evap = await this.evaporatorRepository.save({
          ...evapDto,
          equipmentId,
        });

        if (evapDto.motors?.length) {
          for (const m of evapDto.motors) {
            await this.motorRepository.save({ ...m, evaporatorId: evap.id });
          }
        }
      }
    }

    // Condensadoras + motores + compresores
    if (dto.condensers?.length) {
      for (const condDto of dto.condensers) {
        const cond = await this.condenserRepository.save({
          ...condDto,
          equipmentId,
        });

        if (condDto.motors?.length) {
          for (const m of condDto.motors) {
            await this.motorRepository.save({ ...m, condenserId: cond.id });
          }
        }

        if (condDto.compressors?.length) {
          for (const c of condDto.compressors) {
            await this.compressorRepository.save({
              ...c,
              condenserId: cond.id,
            });
          }
        }
      }
    }

    // Plan de mantenimiento
    if (dto.planMantenimiento) {
      await this.planMantenimientoRepository.save({
        ...dto.planMantenimiento,
        equipmentId,
      });
    }
  }

  // ────────────────────────────────────────────────────────────────
  // FIND
  // ────────────────────────────────────────────────────────────────

  async findAll(params?: {
    clientId?: number;
    areaId?: number;
    subAreaId?: number;
    search?: string;
  }): Promise<Equipment[]> {
    const qb = this.equipmentRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.client', 'client')
      .leftJoinAndSelect('e.area', 'area')
      .leftJoinAndSelect('e.subArea', 'subArea')
      .leftJoinAndSelect('e.images', 'images')
      .leftJoinAndSelect('e.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.workOrder', 'workOrder')
      .leftJoinAndSelect('e.airConditionerType', 'acType')
      .leftJoinAndSelect('e.evaporators', 'evaps')
      .leftJoinAndSelect('evaps.motors', 'evapMotors')
      .leftJoinAndSelect('e.condensers', 'conds')
      .leftJoinAndSelect('conds.motors', 'condMotors')
      .leftJoinAndSelect('conds.compressors', 'comps')
      .leftJoinAndSelect('e.planMantenimiento', 'plan')
      .orderBy('e.createdAt', 'DESC');

    if (params?.clientId)
      qb.andWhere('e.clientId = :clientId', { clientId: params.clientId });
    if (params?.areaId)
      qb.andWhere('e.areaId = :areaId', { areaId: params.areaId });
    if (params?.subAreaId)
      qb.andWhere('e.subAreaId = :subAreaId', { subAreaId: params.subAreaId });
    if (params?.search) {
      qb.andWhere('e.code ILIKE :search', { search: `%${params.search}%` });
    }

    return qb.getMany();
  }

  async findOne(id: number): Promise<Equipment> {
    const eq = await this.equipmentRepository.findOne({
      where: { equipmentId: id },
      relations: [
        'client',
        'area',
        'subArea',
        'images',
        'equipmentWorkOrders',
        'equipmentWorkOrders.workOrder',
        'airConditionerType',
        'evaporators',
        'evaporators.motors',
        'condensers',
        'condensers.motors',
        'condensers.compressors',
        'planMantenimiento',
      ],
    });

    if (!eq) throw new NotFoundException(`Equipo ${id} no encontrado`);
    return eq;
  }

  // ────────────────────────────────────────────────────────────────
  // UPDATE
  // ────────────────────────────────────────────────────────────────

  async update(id: number, dto: UpdateEquipmentDto): Promise<Equipment> {
    let equipment = await this.findOne(id);

    // Cliente
    if (dto.clientId !== undefined) {
      const client = await this.clientRepository.findOne({
        where: { idCliente: dto.clientId },
      });
      if (!client)
        throw new NotFoundException(`Cliente ${dto.clientId} no encontrado`);
      equipment.clientId = dto.clientId;
      equipment.client = client;
    }

    // Ubicación y regeneración de código
    const incomingArea = dto.areaId;
    const incomingSub = dto.subAreaId;

    if (incomingArea !== undefined || incomingSub !== undefined) {
      let finalArea = incomingArea ?? equipment.areaId;
      let finalSub = incomingSub ?? equipment.subAreaId;

      if (finalSub != null) {
        const sub = await this.subAreaRepository.findOne({
          where: { idSubArea: finalSub },
        });
        if (!sub) throw new NotFoundException('Subárea no encontrada');
        if (finalArea != null && finalArea !== sub.areaId) {
          throw new BadRequestException('Área no coincide con subárea');
        }
        finalArea = sub.areaId;
      } else if (finalArea != null) {
        const area = await this.areaRepository.findOne({
          where: { idArea: finalArea },
        });
        if (!area) throw new NotFoundException('Área no encontrada');
      }

      const changed =
        finalArea !== equipment.areaId || finalSub !== equipment.subAreaId;

      if (changed) {
        equipment.areaId = finalArea ?? undefined;
        equipment.subAreaId = finalSub ?? undefined;

        if (finalArea != null) {
          const newCode = await this.generateEquipmentCode(
            equipment.client,
            finalArea,
            finalSub,
            equipment.category,
          );
          equipment.code = newCode;
        }
      }
    }

    // Categoría y tipo de aire
    if (dto.category !== undefined) {
      equipment.category = dto.category;
      if (dto.category === ServiceCategory.AIRES_ACONDICIONADOS) {
        if (dto.airConditionerTypeId == null) {
          throw new BadRequestException('Tipo de aire requerido');
        }
        const ac = await this.acTypeRepository.findOne({
          where: { id: dto.airConditionerTypeId },
        });
        if (!ac) throw new BadRequestException('Tipo de aire no existe');
        equipment.airConditionerTypeId = dto.airConditionerTypeId;
      } else {
        equipment.airConditionerTypeId = undefined;
      }
    }

    // Campos simples
    const { evaporators, condensers, planMantenimiento, ...rest } = dto;
    Object.assign(equipment, rest);

    await this.equipmentRepository.save(equipment);

    // Componentes anidados
    if (
      evaporators !== undefined ||
      condensers !== undefined ||
      planMantenimiento !== undefined
    ) {
      await this.updateComponents(id, dto);
    }

    return this.findOne(id);
  }

  private async updateComponents(
    id: number,
    dto: UpdateEquipmentDto,
  ): Promise<void> {
    // Evaporadores: reemplazo completo si se envía
    if (dto.evaporators !== undefined) {
      await this.evaporatorRepository.delete({ equipmentId: id });
      if (dto.evaporators.length) {
        for (const e of dto.evaporators) {
          const evap = await this.evaporatorRepository.save({
            ...e,
            equipmentId: id,
          });
          if (e.motors?.length) {
            await this.motorRepository.save(
              e.motors.map((m) => ({ ...m, evaporatorId: evap.id })),
            );
          }
        }
      }
    }

    // Condensadoras
    if (dto.condensers !== undefined) {
      await this.condenserRepository.delete({ equipmentId: id });
      if (dto.condensers.length) {
        for (const c of dto.condensers) {
          const cond = await this.condenserRepository.save({
            ...c,
            equipmentId: id,
          });
          if (c.motors?.length) {
            await this.motorRepository.save(
              c.motors.map((m) => ({ ...m, condenserId: cond.id })),
            );
          }
          if (c.compressors?.length) {
            await this.compressorRepository.save(
              c.compressors.map((comp) => ({ ...comp, condenserId: cond.id })),
            );
          }
        }
      }
    }

    // Plan de mantenimiento
    if (dto.planMantenimiento !== undefined) {
      await this.planMantenimientoRepository.delete({ equipmentId: id });
      if (dto.planMantenimiento) {
        await this.planMantenimientoRepository.save({
          ...dto.planMantenimiento,
          equipmentId: id,
        });
      }
    }
  }

  // ────────────────────────────────────────────────────────────────
  // DELETE
  // ────────────────────────────────────────────────────────────────

  async remove(id: number): Promise<void> {
    const eq = await this.findOne(id);
    await this.imagesService.deleteByEquipment(id);
    await this.equipmentRepository.remove(eq); // cascade debería eliminar el resto
  }

  // ────────────────────────────────────────────────────────────────
  // NUEVOS MÉTODOS PARA RELACIÓN CON ÓRDENES
  // ────────────────────────────────────────────────────────────────

  async getEquipmentWorkOrders(equipmentId: number): Promise<any[]> {
    const equipment = await this.equipmentRepository.findOne({
      where: { equipmentId },
      relations: [
        'equipmentWorkOrders',
        'equipmentWorkOrders.workOrder',
        'equipmentWorkOrders.workOrder.service',
        'equipmentWorkOrders.workOrder.cliente',
        'equipmentWorkOrders.workOrder.tecnico',
      ],
    });

    if (!equipment) {
      throw new NotFoundException(`Equipo ${equipmentId} no encontrado`);
    }

    return equipment.equipmentWorkOrders.map((ewo) => ({
      id: ewo.id,
      workOrderId: ewo.workOrder.ordenId,
      description: ewo.description,
      createdAt: ewo.createdAt,
      workOrder: {
        ordenId: ewo.workOrder.ordenId,
        fechaSolicitud: ewo.workOrder.fechaSolicitud,
        estado: ewo.workOrder.estado,
        tipoServicio: ewo.workOrder.tipoServicio,
        service: ewo.workOrder.service,
        cliente: ewo.workOrder.cliente,
        tecnico: ewo.workOrder.tecnico,
      },
    }));
  }
}
