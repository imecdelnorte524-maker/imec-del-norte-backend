// src/equipment/equipment.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
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
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { AirConditionerType } from '../air-conditioner-types/entities/air-conditioner-type.entity';
import { ServiceCategory } from '../services/enums/service.enums';
import { EquipmentMotor } from './entities/motor.entity';
import { EquipmentEvaporator } from './entities/evaporator.entity';
import { EquipmentCondenser } from './entities/condenser.entity';

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
    @InjectRepository(AirConditionerType)
    private readonly acTypeRepository: Repository<AirConditionerType>,
    private readonly imagesService: ImagesService,
  ) {}

  // ==== NUEVA LÓGICA DE GENERACIÓN DE CÓDIGO ====

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

  // De momento no usamos esto, pero lo dejo por si luego amplías otras categorías
  private getCategoryPrefix(category: string): string {
    const normalized = (category || '').toLowerCase();
    if (normalized.includes('aire')) return 'AA';
    if (normalized.includes('incend')) return 'RCI';
    if (normalized.includes('eléct') || normalized.includes('elect')) return 'RE';
    if (normalized.includes('obra')) return 'OC';
    return 'EQ';
  }

  private async getAreaIndex(clientId: number, areaId: number): Promise<string> {
    const areas = await this.areaRepository.find({
      where: { clienteId: clientId },
      order: { createdAt: 'ASC' },
    });
    const index = areas.findIndex((a) => a.idArea === areaId);
    if (index === -1) {
      throw new BadRequestException('El área no pertenece al cliente');
    }
    return (index + 1).toString().padStart(2, '0');
  }

  private async getSubAreaIndex(subAreaId: number): Promise<string> {
    const subArea = await this.subAreaRepository.findOne({
      where: { idSubArea: subAreaId },
    });
    if (!subArea) {
      throw new BadRequestException('Subárea no encontrada');
    }

    const parentId = subArea.parentSubAreaId ?? null;
    const siblings = await this.subAreaRepository.find({
      where: {
        areaId: subArea.areaId,
        parentSubAreaId: parentId === null ? IsNull() : parentId,
      },
      order: { createdAt: 'ASC' },
    });

    const index = siblings.findIndex((s) => s.idSubArea === subAreaId);
    if (index === -1) {
      throw new BadRequestException('Error al calcular índice de subárea');
    }
    return (index + 1).toString().padStart(2, '0');
  }

  private async getEquipmentIndexInLocation(
    clientId: number,
    areaId: number,
    subAreaId: number | null,
  ): Promise<string> {
    const where: any = {
      clientId,
      areaId,
    };
    if (subAreaId !== null) {
      where.subAreaId = subAreaId;
    } else {
      where.subAreaId = IsNull();
    }

    const count = await this.equipmentRepository.count({ where });
    return (count + 1).toString().padStart(2, '0');
  }

  private async generateEquipmentCode(
    client: Client,
    areaId: number,
    subAreaId: number | null,
  ): Promise<string> {
    const clientInitials = this.getClientInitials(client.nombre);
    const categoryPrefix = 'AA'; // Solo aires, según el flujo actual

    // 1) Índice de área
    const areaIndex = await this.getAreaIndex(client.idCliente, areaId);

    // 2) Ruta completa de subáreas (si hay)
    let subAreasPath = '';
    let currentSubAreaId = subAreaId;

    while (currentSubAreaId) {
      const index = await this.getSubAreaIndex(currentSubAreaId);
      subAreasPath = index + subAreasPath; // prepend
      const subArea = await this.subAreaRepository.findOne({
        where: { idSubArea: currentSubAreaId },
      });
      currentSubAreaId = subArea?.parentSubAreaId ?? null;
    }

    // 3) Índice del equipo (dentro de esa ubicación)
    const equipmentIndex = await this.getEquipmentIndexInLocation(
      client.idCliente,
      areaId,
      subAreaId,
    );

    // Resultado: CI AA 01 02 01 01
    const code = `${clientInitials}${categoryPrefix}${areaIndex}${subAreasPath}${equipmentIndex}`;
    return code;
  }

  // ==== VALIDACIONES Y CREACIÓN ====

  async create(createEquipmentDto: CreateEquipmentDto): Promise<Equipment> {
    const client = await this.clientRepository.findOne({
      where: { idCliente: createEquipmentDto.clientId },
    });
    if (!client) {
      throw new NotFoundException(
        `Cliente con ID ${createEquipmentDto.clientId} no encontrado`,
      );
    }

    // Validación de ubicación obligatoria
    if (!createEquipmentDto.areaId && !createEquipmentDto.subAreaId) {
      throw new BadRequestException(
        'Debe proporcionar al menos un área o subárea',
      );
    }

    // Validar/ajustar área y subárea
    let finalAreaId = createEquipmentDto.areaId;
    let finalSubAreaId = createEquipmentDto.subAreaId ?? null;

    if (finalSubAreaId) {
      const subArea = await this.subAreaRepository.findOne({
        where: { idSubArea: finalSubAreaId },
      });
      if (!subArea) {
        throw new NotFoundException(
          `Subárea con ID ${finalSubAreaId} no encontrada`,
        );
      }

      // Si viene areaId, debe coincidir con la del subArea
      if (finalAreaId && finalAreaId !== subArea.areaId) {
        throw new BadRequestException(
          'El área proporcionada no coincide con el área de la subárea',
        );
      }

      // Si no viene areaId, lo tomamos de la subárea
      finalAreaId = subArea.areaId;
    } else {
      // Solo viene área
      const area = await this.areaRepository.findOne({
        where: { idArea: finalAreaId },
      });
      if (!area) {
        throw new NotFoundException(`Área con ID ${finalAreaId} no encontrada`);
      }
    }

    // Validar orden de trabajo (como tenías antes)
    if (createEquipmentDto.workOrderId) {
      const workOrder = await this.workOrderRepository.findOne({
        where: { ordenId: createEquipmentDto.workOrderId },
      });

      if (!workOrder) {
        throw new NotFoundException(
          `Orden de trabajo con ID ${createEquipmentDto.workOrderId} no encontrada`,
        );
      }

      if (
        workOrder.clienteEmpresaId &&
        workOrder.clienteEmpresaId !== createEquipmentDto.clientId
      ) {
        throw new BadRequestException(
          'La orden de trabajo no pertenece a la misma empresa (cliente) del equipo',
        );
      }
    }

    // Validación de tipo de aire acondicionado
    if (createEquipmentDto.category === ServiceCategory.AIRES_ACONDICIONADOS) {
      if (!createEquipmentDto.airConditionerTypeId) {
        throw new BadRequestException(
          'Debe especificar el tipo de aire acondicionado',
        );
      }

      const acType = await this.acTypeRepository.findOne({
        where: { id: createEquipmentDto.airConditionerTypeId },
      });
      if (!acType) {
        throw new BadRequestException(
          'El tipo de aire acondicionado no existe',
        );
      }

      if (!acType.hasEvaporator && createEquipmentDto.evaporator) {
        throw new BadRequestException(
          'Este tipo de aire no tiene evaporador, no se aceptan datos de evaporador',
        );
      }

      if (!acType.hasCondenser && createEquipmentDto.condenser) {
        throw new BadRequestException(
          'Este tipo de aire no tiene condensadora, no se aceptan datos de condensadora',
        );
      }
    } else {
      if (createEquipmentDto.airConditionerTypeId) {
        throw new BadRequestException(
          'Solo los equipos de Aires Acondicionados pueden tener airConditionerTypeId',
        );
      }
    }

    // Generar código interno
    if (!finalAreaId) {
      throw new BadRequestException(
        'El área es requerida para generar el código del equipo',
      );
    }
    const code = await this.generateEquipmentCode(
      client,
      finalAreaId,
      finalSubAreaId,
    );

    // Crear equipo (sin componentes todavía)
    const equipment = this.equipmentRepository.create({
      ...createEquipmentDto,
      areaId: finalAreaId,
      subAreaId: finalSubAreaId === null ? undefined : finalSubAreaId,
      code,
    });

    const savedEquipment = await this.equipmentRepository.save(equipment);

    // Crear componentes
    await this.createComponents(savedEquipment, createEquipmentDto);

    // Recargar con relaciones
    return this.findOne(savedEquipment.equipmentId);
  }

  private async createComponents(
    equipment: Equipment,
    dto: CreateEquipmentDto,
  ): Promise<void> {
    // Motor
    if (dto.motor) {
      const motor = this.equipmentRepository.manager.create(EquipmentMotor, {
        ...dto.motor,
        equipmentId: equipment.equipmentId,
      });
      await this.equipmentRepository.manager.save(motor);
    }

    // Evaporador
    if (dto.evaporator) {
      const evaporator = this.equipmentRepository.manager.create(
        EquipmentEvaporator,
        {
          ...dto.evaporator,
          equipmentId: equipment.equipmentId,
        },
      );
      await this.equipmentRepository.manager.save(evaporator);
    }

    // Condensadora
    if (dto.condenser) {
      const condenser = this.equipmentRepository.manager.create(
        EquipmentCondenser,
        {
          ...dto.condenser,
          equipmentId: equipment.equipmentId,
        },
      );
      await this.equipmentRepository.manager.save(condenser);
    }
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
      .leftJoinAndSelect('equipment.airConditionerType', 'airConditionerType')
      .leftJoinAndSelect('equipment.motors', 'motors')
      .leftJoinAndSelect('equipment.evaporators', 'evaporators')
      .leftJoinAndSelect('equipment.condensers', 'condensers')
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
      relations: [
        'client',
        'area',
        'subArea',
        'images',
        'workOrder',
        'airConditionerType',
        'motors',
        'evaporators',
        'condensers',
      ],
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

    // Validación de cliente si cambia
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

    // Validación y posible cambio de ubicación
    if (updateEquipmentDto.areaId || updateEquipmentDto.subAreaId) {
      let finalAreaId = updateEquipmentDto.areaId ?? equipment.areaId;
      let finalSubAreaId =
        updateEquipmentDto.subAreaId ?? equipment.subAreaId ?? null;

      if (finalSubAreaId) {
        const subArea = await this.subAreaRepository.findOne({
          where: { idSubArea: finalSubAreaId },
        });
        if (!subArea) {
          throw new NotFoundException(
            `Subárea con ID ${finalSubAreaId} no encontrada`,
          );
        }

        if (finalAreaId && finalAreaId !== subArea.areaId) {
          throw new BadRequestException(
            'El área proporcionada no coincide con el área de la subárea',
          );
        }

        finalAreaId = subArea.areaId;
      } else if (finalAreaId) {
        const area = await this.areaRepository.findOne({
          where: { idArea: finalAreaId },
        });
        if (!area) {
          throw new NotFoundException(
            `Área con ID ${finalAreaId} no encontrada`,
          );
        }
      }

      // Recalcular código si cambia ubicación
      if (!finalAreaId) {
        throw new BadRequestException(
          'El área es requerida para generar el código del equipo',
        );
      }
      const client = equipment.client;
      const newCode = await this.generateEquipmentCode(
        client,
        finalAreaId,
        finalSubAreaId,
      );

      equipment.code = newCode;
      equipment.areaId = finalAreaId;
      equipment.subAreaId = finalSubAreaId ?? undefined;
    }

    // Validación de tipo de aire acondicionado
    if (updateEquipmentDto.category === ServiceCategory.AIRES_ACONDICIONADOS) {
      if (!updateEquipmentDto.airConditionerTypeId) {
        throw new BadRequestException(
          'Debe especificar el tipo de aire acondicionado',
        );
      }

      const acType = await this.acTypeRepository.findOne({
        where: { id: updateEquipmentDto.airConditionerTypeId },
      });
      if (!acType) {
        throw new BadRequestException(
          'El tipo de aire acondicionado no existe',
        );
      }

      if (!acType.hasEvaporator && updateEquipmentDto.evaporator) {
        throw new BadRequestException(
          'Este tipo de aire no tiene evaporador, no se aceptan datos de evaporador',
        );
      }

      if (!acType.hasCondenser && updateEquipmentDto.condenser) {
        throw new BadRequestException(
          'Este tipo de aire no tiene condensadora, no se aceptan datos de condensadora',
        );
      }
    } else {
      if (updateEquipmentDto.airConditionerTypeId) {
        throw new BadRequestException(
          'Solo los equipos de Aires Acondicionados pueden tener airConditionerTypeId',
        );
      }
    }

    // Actualizar componentes
    if (updateEquipmentDto.motor) {
      await this.updateComponent(
        equipment,
        updateEquipmentDto.motor,
        EquipmentMotor,
      );
    }

    if (updateEquipmentDto.evaporator) {
      await this.updateComponent(
        equipment,
        updateEquipmentDto.evaporator,
        EquipmentEvaporator,
      );
    }

    if (updateEquipmentDto.condenser) {
      await this.updateComponent(
        equipment,
        updateEquipmentDto.condenser,
        EquipmentCondenser,
      );
    }

    // Actualizar campos básicos (sin tocar code porque ya lo manejamos arriba)
    const { motor, evaporator, condenser, ...rest } = updateEquipmentDto as any;
    Object.assign(equipment, rest);
    await this.equipmentRepository.save(equipment);

    return this.findOne(id);
  }

  private async updateComponent(
    equipment: Equipment,
    componentData: any,
    entityClass: any,
  ): Promise<void> {
    const existing = await this.equipmentRepository.manager.findOne(
      entityClass,
      { where: { equipmentId: equipment.equipmentId } },
    );

    if (existing) {
      Object.assign(existing, componentData);
      await this.equipmentRepository.manager.save(existing);
    } else {
      const newComponent = this.equipmentRepository.manager.create(
        entityClass,
        {
          ...componentData,
          equipmentId: equipment.equipmentId,
        },
      );
      await this.equipmentRepository.manager.save(newComponent);
    }
  }

  async remove(id: number): Promise<void> {
    await this.imagesService.deleteByEquipment(id);

    await this.equipmentRepository.manager.delete(EquipmentMotor, {
      equipmentId: id,
    });
    await this.equipmentRepository.manager.delete(EquipmentEvaporator, {
      equipmentId: id,
    });
    await this.equipmentRepository.manager.delete(EquipmentCondenser, {
      equipmentId: id,
    });

    const equipment = await this.findOne(id);
    await this.equipmentRepository.remove(equipment);
  }
}