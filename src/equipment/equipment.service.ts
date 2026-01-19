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
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { AirConditionerType } from '../air-conditioner-types/entities/air-conditioner-type.entity';
import { ServiceCategory } from '../services/enums/service.enums';
import { EquipmentMotor } from './entities/motor.entity';
import { EquipmentEvaporator } from './entities/evaporator.entity';
import { EquipmentCondenser } from './entities/condenser.entity';
import { EquipmentCompressor } from './entities/compressor.entity';
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
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
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
    private readonly imagesService: ImagesService,
  ) {}

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

  private getCategoryPrefix(category: ServiceCategory): string {
    if (category === ServiceCategory.AIRES_ACONDICIONADOS) return 'AA';
    if (category === ServiceCategory.REDES_CONTRA_INCENDIOS) return 'RCI';
    if (category === ServiceCategory.REDES_ELECTRICAS) return 'RE';
    if (category === ServiceCategory.OBRAS_CIVILES) return 'OC';
    return 'EQ';
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
    subAreaId: number | null | undefined,
    category: ServiceCategory,
  ): Promise<string> {
    const clientInitials = this.getClientInitials(client.nombre);
    const categoryPrefix = this.getCategoryPrefix(category);

    // 1) Índice de área
    const areaIndex = await this.getAreaIndex(client.idCliente, areaId);

    // 2) Ruta completa de subáreas (si hay)
    let subAreasPath = '';
    let currentSubAreaId = subAreaId ?? null;

    while (currentSubAreaId) {
      const index = await this.getSubAreaIndex(currentSubAreaId);
      subAreasPath = index + subAreasPath; // prepend
      const subArea = await this.subAreaRepository.findOne({
        where: { idSubArea: currentSubAreaId },
      });
      currentSubAreaId = subArea?.parentSubAreaId ?? null;
    }

    // Si no hay subáreas, usar '00'
    if (subAreasPath === '') {
      subAreasPath = '00';
    }

    // 3) Índice del equipo (dentro de esa ubicación)
    const equipmentIndex = await this.getEquipmentIndexInLocation(
      client.idCliente,
      areaId,
      subAreaId ?? null,
    );

    // Resultado: CI-AA-01-02-01
    const code = `${clientInitials}${categoryPrefix}${areaIndex}${subAreasPath}${equipmentIndex}`;
    return code;
  }

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

    // Validación de ubicación
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

      if (finalAreaId && finalAreaId !== subArea.areaId) {
        throw new BadRequestException(
          'El área proporcionada no coincide con el área de la subárea',
        );
      }

      finalAreaId = subArea.areaId;
    } else {
      const area = await this.areaRepository.findOne({
        where: { idArea: finalAreaId },
      });
      if (!area) {
        throw new NotFoundException(`Área con ID ${finalAreaId} no encontrada`);
      }
    }

    // Validar orden de trabajo
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
      createEquipmentDto.category,
    );

    // Crear equipo base
    const equipmentData = {
      ...createEquipmentDto,
      areaId: finalAreaId,
      subAreaId: finalSubAreaId === null ? undefined : finalSubAreaId,
      code,
      status: createEquipmentDto.status || EquipmentStatus.ACTIVE,
    };

    const equipment = this.equipmentRepository.create(equipmentData);
    const savedEquipment = await this.equipmentRepository.save(equipment);

    await this.createComponents(savedEquipment.equipmentId, createEquipmentDto);

    return this.findOne(savedEquipment.equipmentId);
  }

  private async createComponents(
    equipmentId: number,
    dto: CreateEquipmentDto,
  ): Promise<void> {
    if (dto.motor) {
      await this.motorRepository.save(
        this.motorRepository.create({ ...dto.motor, equipmentId }),
      );
    }
    if (dto.evaporator) {
      await this.evaporatorRepository.save(
        this.evaporatorRepository.create({ ...dto.evaporator, equipmentId }),
      );
    }
    if (dto.condenser) {
      await this.condenserRepository.save(
        this.condenserRepository.create({ ...dto.condenser, equipmentId }),
      );
    }
    if (dto.compressor) {
      await this.compressorRepository.save(
        this.compressorRepository.create({ ...dto.compressor, equipmentId }),
      );
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
      .leftJoinAndSelect('equipment.compressors', 'compressors')
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
        'compressors',
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

    const originalAreaId = equipment.areaId ?? null;
    const originalSubAreaId = equipment.subAreaId ?? null;

    if (updateEquipmentDto.clientId !== undefined) {
      const client = await this.clientRepository.findOne({
        where: { idCliente: updateEquipmentDto.clientId },
      });
      if (!client)
        throw new NotFoundException(
          `Cliente con ID ${updateEquipmentDto.clientId} no encontrado`,
        );
      equipment.clientId = updateEquipmentDto.clientId;
      equipment.client = client;
    }

    const incomingAreaId = updateEquipmentDto.areaId;
    const incomingSubAreaId = updateEquipmentDto.subAreaId;

    if (incomingAreaId !== undefined || incomingSubAreaId !== undefined) {
      let finalAreaId =
        incomingAreaId !== undefined ? incomingAreaId : equipment.areaId;
      let finalSubAreaId =
        incomingSubAreaId !== undefined
          ? incomingSubAreaId
          : equipment.subAreaId;

      // Normalizar: aseguramos que undefined se vuelva null para la lógica interna
      // (aunque TypeScript prefiera undefined para los tipos opcionales)
      finalAreaId = finalAreaId ?? undefined;
      finalSubAreaId = finalSubAreaId ?? undefined;

      if (finalSubAreaId !== null) {
        const subArea = await this.subAreaRepository.findOne({
          where: { idSubArea: finalSubAreaId },
        });
        if (!subArea)
          throw new NotFoundException(
            `Subárea con ID ${finalSubAreaId} no encontrada`,
          );

        if (finalAreaId && finalAreaId !== subArea.areaId) {
          throw new BadRequestException(
            'El área no coincide con el área de la subárea',
          );
        }
        finalAreaId = subArea.areaId;
      } else if (finalAreaId !== null) {
        const area = await this.areaRepository.findOne({
          where: { idArea: finalAreaId },
        });
        if (!area)
          throw new NotFoundException(`Área con ID ${finalAreaId} no encontrada`);
      }

      const locationChanged =
        finalAreaId !== originalAreaId || finalSubAreaId !== originalSubAreaId;

      if (locationChanged) {
        // Desconectar relaciones para que TypeORM no use los objetos viejos cargados
        delete equipment.area;
        delete equipment.subArea;

        // CORRECCIÓN TS 2322: Usamos 'as any' para permitir asignar null
        // a una propiedad que la entidad define como opcional (number | undefined).
        // Esto fuerza a TypeORM a limpiar la columna en BD.
        equipment.areaId = (finalAreaId ?? null) as any;
        equipment.subAreaId = (finalSubAreaId ?? null) as any;

        if (finalAreaId !== undefined) {
          const client = equipment.client;
          // CORRECCIÓN TS 2345: finalAreaId aquí es 'number' porque chequeamos !== null
          const newCode = await this.generateEquipmentCode(
            client,
            finalAreaId,
            finalSubAreaId,
            equipment.category,
          );
          equipment.code = newCode;
        }
      }
    }

    if (updateEquipmentDto.category === ServiceCategory.AIRES_ACONDICIONADOS) {
      if (updateEquipmentDto.airConditionerTypeId !== undefined) {
        if (!updateEquipmentDto.airConditionerTypeId)
          throw new BadRequestException('Tipo de aire requerido');
        const acType = await this.acTypeRepository.findOne({
          where: { id: updateEquipmentDto.airConditionerTypeId },
        });
        if (!acType)
          throw new BadRequestException('Tipo de aire no existe');

        if (!acType.hasEvaporator && updateEquipmentDto.evaporator)
          throw new BadRequestException('Este tipo no usa evaporador');
        if (!acType.hasCondenser && updateEquipmentDto.condenser)
          throw new BadRequestException('Este tipo no usa condensadora');

        equipment.airConditionerTypeId =
          updateEquipmentDto.airConditionerTypeId;
      }
    } else if (updateEquipmentDto.category) {
      if (updateEquipmentDto.airConditionerTypeId)
        throw new BadRequestException(
          'Solo aires acondicionados llevan tipo de aire',
        );
      equipment.airConditionerTypeId = undefined;
      equipment.airConditionerType = undefined;
    }

    const {
      motor,
      evaporator,
      condenser,
      compressor,
      areaId,
      subAreaId,
      clientId,
      ...rest
    } = updateEquipmentDto as any;

    Object.assign(equipment, rest);

    await this.equipmentRepository.save(equipment);

    if (motor !== undefined)
      await this.updateComponent(
        equipment.equipmentId,
        motor,
        this.motorRepository,
      );
    if (evaporator !== undefined)
      await this.updateComponent(
        equipment.equipmentId,
        evaporator,
        this.evaporatorRepository,
      );
    if (condenser !== undefined)
      await this.updateComponent(
        equipment.equipmentId,
        condenser,
        this.condenserRepository,
      );
    if (compressor !== undefined)
      await this.updateComponent(
        equipment.equipmentId,
        compressor,
        this.compressorRepository,
      );

    return this.findOne(id);
  }

  private async updateComponent(
    equipmentId: number,
    componentData: any,
    repository: Repository<any>,
  ): Promise<void> {
    if (componentData === null) {
      await repository.delete({ equipmentId });
      return;
    }
    const existing = await repository.findOne({ where: { equipmentId } });
    if (existing) {
      Object.assign(existing, componentData);
      await repository.save(existing);
    } else if (Object.keys(componentData).length > 0) {
      await repository.save(repository.create({ ...componentData, equipmentId }));
    }
  }

  async remove(id: number): Promise<void> {
    const equipment = await this.findOne(id);
    await this.imagesService.deleteByEquipment(id);
    await this.motorRepository.delete({ equipmentId: id });
    await this.evaporatorRepository.delete({ equipmentId: id });
    await this.condenserRepository.delete({ equipmentId: id });
    await this.compressorRepository.delete({ equipmentId: id });
    await this.equipmentRepository.remove(equipment);
  }
}