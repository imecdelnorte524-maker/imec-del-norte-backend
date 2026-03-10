import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource, In, Not } from 'typeorm';
import { Equipment } from './entities/equipment.entity';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { Client } from '../client/entities/client.entity';
import { Area } from '../area/entities/area.entity';
import { SubArea } from '../sub-area/entities/sub-area.entity';
import { ImagesService } from '../images/images.service';
import { AirConditionerType } from '../air-conditioner-types/entities/air-conditioner-type.entity';
import { ServiceCategory } from '../shared/index';
import { EquipmentMotor } from './entities/motor.entity';
import { EquipmentEvaporator } from './entities/evaporator.entity';
import { EquipmentCondenser } from './entities/condenser.entity';
import { EquipmentCompressor } from './entities/compressor.entity';
import { PlanMantenimiento } from './entities/plan-mantenimiento.entity';
import { EquipmentStatus } from '../shared/index';
import { BaseSequenceService } from '../common/services/base-sequence.service';
import { SequenceHelperService } from '../common/services/sequence-helper.service';
import { PlanMantenimientoDto } from './dto/plan-mantenimiento.dto';
import { UnidadFrecuencia } from '../shared/index';
import { EquipmentDocumentsService } from './equipment-documents.service';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { buildEquipmentInventoryExcel } from '../../templates/excel/equipment-inventory.template';
import { buildAnnualMaintenancePlanExcel } from '../../templates/excel/equipment-annual-maintenance.template';
import { buildEquipmentHistoryParams } from '../../templates/report/equipment-history-html.helper';
import { PdfService } from '../pdf/pdf.service';
import { ConfigService } from '@nestjs/config';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { User } from '../users/entities/user.entity';

interface OrphanedRecordIssue {
  table: string;
  issue: string;
  count: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface SequenceCorrection {
  table: string;
  corrected: boolean;
  message: string;
}

interface FullDiagnosis {
  timestamp: string;
  equipment: any;
  evaporators: any;
  condensers: any;
  motors: any;
  compressors: any;
  maintenancePlans: any;
  integrityIssues: OrphanedRecordIssue[];
  recommendations: string[];
}

@Injectable()
export class EquipmentService
  extends BaseSequenceService
  implements OnModuleInit
{
  // Usar protected para que sea accesible desde la clase base
  protected readonly logger = new Logger(EquipmentService.name);

  constructor(
    protected readonly sequenceHelper: SequenceHelperService,
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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly imagesService: ImagesService,
    private readonly dataSource: DataSource,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly equipmentDocumentsServices: EquipmentDocumentsService,
    private readonly pdfService: PdfService,
    private readonly configService: ConfigService,
    private readonly workOrdersService: WorkOrdersService,
  ) {
    super(sequenceHelper);

    // Configurar secuencia principal para equipos
    this.tableName = 'equipos';
    this.idColumn = 'equipo_id';
  }

  async onModuleInit() {
    // Inicializar secuencia al cargar el módulo
    await this.initializeAllSequences();
  }

  /**
   * Inicializa todas las secuencias relacionadas con equipos
   */
  private async initializeAllSequences(): Promise<void> {
    try {
      // Inicializar secuencia principal de equipos
      await this.initializeSequence();

      // Inicializar secuencias de tablas relacionadas
      const relatedSequences = [
        {
          table: 'equipment_evaporators',
          idColumn: 'id',
          sequence: 'equipment_evaporators_id_seq',
        },
        {
          table: 'equipment_condensers',
          idColumn: 'id',
          sequence: 'equipment_condensers_id_seq',
        },
        {
          table: 'equipment_motors',
          idColumn: 'id',
          sequence: 'equipment_motors_id_seq',
        },
        {
          table: 'equipment_compressors',
          idColumn: 'id',
          sequence: 'equipment_compressors_id_seq',
        },
        {
          table: 'plan_mantenimiento',
          idColumn: 'id',
          sequence: 'plan_mantenimiento_id_seq',
        },
      ];

      for (const seq of relatedSequences) {
        try {
          const result = await this.sequenceHelper.checkAndFixSequence(
            seq.table,
            seq.idColumn,
            seq.sequence,
          );

          if (result.corrected) {
            this.logger.log(`✅ Secuencia ${seq.sequence} corregida`);
          }
        } catch (error) {
          this.logger.warn(
            `⚠️ No se pudo inicializar secuencia ${seq.sequence}: ${error.message}`,
          );
        }
      }

      this.logger.log('✅ Secuencias de equipos inicializadas correctamente');
    } catch (error) {
      this.logger.error('❌ Error inicializando secuencias de equipos:', error);
    }
  }

  /**
   * Obtiene diagnóstico completo del sistema de equipos
   */
  async getFullDiagnosis(): Promise<FullDiagnosis> {
    try {
      // Diagnóstico de tablas principales
      const equipmentDiagnosis = await this.diagnoseTable(['code']);
      const evaporatorsDiagnosis = await this.sequenceHelper.diagnoseTable(
        'equipment_evaporators',
        'id',
        'equipment_evaporators_id_seq',
        ['serial'],
      );
      const condensersDiagnosis = await this.sequenceHelper.diagnoseTable(
        'equipment_condensers',
        'id',
        'equipment_condensers_id_seq',
        ['serial'],
      );
      const motorsDiagnosis = await this.sequenceHelper.diagnoseTable(
        'equipment_motors',
        'id',
        'equipment_motors_id_seq',
      );
      const compressorsDiagnosis = await this.sequenceHelper.diagnoseTable(
        'equipment_compressors',
        'id',
        'equipment_compressors_id_seq',
        ['serial'],
      );
      const planDiagnosis = await this.sequenceHelper.diagnoseTable(
        'plan_mantenimiento',
        'id',
        'plan_mantenimiento_id_seq',
      );

      // Verificar integridad de relaciones
      const orphanedRecords = await this.checkOrphanedRecords();

      return {
        timestamp: new Date().toISOString(),
        equipment: equipmentDiagnosis,
        evaporators: evaporatorsDiagnosis,
        condensers: condensersDiagnosis,
        motors: motorsDiagnosis,
        compressors: compressorsDiagnosis,
        maintenancePlans: planDiagnosis,
        integrityIssues: orphanedRecords,
        recommendations: await this.generateRecommendations(),
      };
    } catch (error) {
      this.logger.error('Error en diagnóstico completo:', error);
      throw error;
    }
  }

  /**
   * Verifica registros huérfanos en las relaciones
   */
  private async checkOrphanedRecords(): Promise<OrphanedRecordIssue[]> {
    const issues: OrphanedRecordIssue[] = [];

    try {
      // Motores sin evaporador ni condensador
      const orphanedMotors = await this.motorRepository
        .createQueryBuilder('motor')
        .where('motor.evaporatorId IS NULL AND motor.condenserId IS NULL')
        .getCount();

      if (orphanedMotors > 0) {
        issues.push({
          table: 'equipment_motors',
          issue: 'Motores sin relación',
          count: orphanedMotors,
          severity: 'MEDIUM',
        });
      }

      // Compresores sin condensador
      const orphanedCompressors = await this.compressorRepository
        .createQueryBuilder('comp')
        .leftJoin('comp.condenser', 'condenser')
        .where('condenser.id IS NULL')
        .getCount();

      if (orphanedCompressors > 0) {
        issues.push({
          table: 'equipment_compressors',
          issue: 'Compresores sin condensador',
          count: orphanedCompressors,
          severity: 'HIGH',
        });
      }

      // Planes sin equipo
      const orphanedPlans = await this.planMantenimientoRepository
        .createQueryBuilder('plan')
        .leftJoin('plan.equipment', 'equipment')
        .where('equipment.equipmentId IS NULL')
        .getCount();

      if (orphanedPlans > 0) {
        issues.push({
          table: 'plan_mantenimiento',
          issue: 'Planes de mantenimiento sin equipo',
          count: orphanedPlans,
          severity: 'HIGH',
        });
      }
    } catch (error) {
      this.logger.warn('Error verificando registros huérfanos:', error);
    }

    return issues;
  }

  /**
   * Genera recomendaciones basadas en el diagnóstico
   */
  private async generateRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    // Verificar si hay equipos duplicados por código
    const duplicateCodes = await this.equipmentRepository
      .createQueryBuilder('eq')
      .select('eq.code, COUNT(*) as count')
      .groupBy('eq.code')
      .having('COUNT(*) > 1')
      .getRawMany();

    if (duplicateCodes.length > 0) {
      recommendations.push(
        `Se encontraron ${duplicateCodes.length} códigos de equipo duplicados.`,
      );
    }

    // Verificar equipos sin ubicación
    const equipmentWithoutLocation = await this.equipmentRepository
      .createQueryBuilder('eq')
      .where('eq.areaId IS NULL AND eq.subAreaId IS NULL')
      .getCount();

    if (equipmentWithoutLocation > 0) {
      recommendations.push(
        `${equipmentWithoutLocation} equipos no tienen ubicación asignada.`,
      );
    }

    return recommendations;
  }

  // ────────────────────────────────────────────────────────────────
  // Helpers para generación de código (mantener los existentes)
  // ────────────────────────────────────────────────────────────────

  private getClientInitials(clientName: string): string {
    if (!clientName?.trim()) return 'XX';

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
    if (index === -1) {
      throw new BadRequestException('Área no pertenece al cliente');
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
      throw new BadRequestException('Error calculando índice de subárea');
    }

    return (index + 1).toString().padStart(2, '0');
  }

  private async getEquipmentIndexInLocation(
    clientId: number,
    areaId: number,
    subAreaId: number | null,
  ): Promise<string> {
    const where: any = { clientId, areaId };
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

    if (!subAreasPath) {
      subAreasPath = '00';
    }

    const equipmentIndex = await this.getEquipmentIndexInLocation(
      client.idCliente,
      areaId,
      subAreaId ?? null,
    );

    return `${clientInitials}${categoryPrefix}${areaIndex}${subAreasPath}${equipmentIndex}`;
  }

  private async validateEvapCondComponentsForAirType(params: {
    category: ServiceCategory;
    airConditionerTypeId?: number;
    evaporators?: any[];
    condensers?: any[];
  }): Promise<void> {
    const { category, airConditionerTypeId, evaporators, condensers } = params;

    // Solo aplica para AIRES_ACONDICIONADOS
    if (category !== ServiceCategory.AIRES_ACONDICIONADOS) {
      return;
    }

    if (!airConditionerTypeId) {
      throw new BadRequestException(
        'Tipo de aire requerido para validar evaporadoras y condensadoras',
      );
    }

    const acType = await this.acTypeRepository.findOne({
      where: { id: airConditionerTypeId },
    });

    if (!acType) {
      throw new BadRequestException(
        `Tipo de aire ${airConditionerTypeId} no existe`,
      );
    }

    const typeName = (acType.name || '').toLowerCase();

    // Solo estos tipos pueden tener MÁS de una evap/cond
    const isMultiSplitOrVariable =
      typeName.includes('multi') ||
      typeName.includes('variable') ||
      typeName.includes('vrf') ||
      typeName.includes('vrv');

    // 1) Respetar hasEvaporator / hasCondenser
    if (
      acType.hasEvaporator === false &&
      evaporators &&
      evaporators.length > 0
    ) {
      throw new BadRequestException(
        `El tipo de aire "${acType.name}" no permite evaporador y se envió al menos uno`,
      );
    }

    if (acType.hasCondenser === false && condensers && condensers.length > 0) {
      throw new BadRequestException(
        `El tipo de aire "${acType.name}" no permite condensadora y se envió al menos una`,
      );
    }

    // 2) Regla de negocio: solo multisplit/variable más de uno
    if (!isMultiSplitOrVariable) {
      if (evaporators && evaporators.length > 1) {
        throw new BadRequestException(
          `El tipo de aire "${acType.name}" solo permite un evaporador`,
        );
      }

      if (condensers && condensers.length > 1) {
        throw new BadRequestException(
          `El tipo de aire "${acType.name}" solo permite una condensadora`,
        );
      }
    }
  }

  // ────────────────────────────────────────────────────────────────
  // CREATE - Con transacción completa y manejo de secuencia
  // ────────────────────────────────────────────────────────────────

  async create(
    dto: CreateEquipmentDto,
    createdBy?: string,
  ): Promise<Equipment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar secuencia antes de crear
      await this.ensureSequenceIsReady();

      // Validar cliente
      const client = await this.clientRepository.findOne({
        where: { idCliente: dto.clientId },
      });

      if (!client) {
        throw new NotFoundException(`Cliente ${dto.clientId} no encontrado`);
      }

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

        if (!sub) {
          throw new NotFoundException(
            `Subárea ${finalSubAreaId} no encontrada`,
          );
        }

        if (finalAreaId && finalAreaId !== sub.areaId) {
          throw new BadRequestException('Área no coincide con subárea');
        }

        finalAreaId = sub.areaId;
      } else if (finalAreaId) {
        const area = await this.areaRepository.findOne({
          where: { idArea: finalAreaId },
        });

        if (!area) {
          throw new NotFoundException(`Área ${finalAreaId} no encontrada`);
        }
      }

      // Validar categoría y tipo de aire
      await this.validateCategoryAndAirConditionerType(dto);

      // Generar código
      if (!finalAreaId) {
        throw new BadRequestException('Área requerida para generar código');
      }

      const code = await this.generateEquipmentCode(
        client,
        finalAreaId,
        finalSubAreaId,
        dto.category,
      );

      // Verificar que el código no exista
      const existingWithCode = await this.equipmentRepository.findOne({
        where: { code },
      });

      if (existingWithCode) {
        throw new BadRequestException(
          `Ya existe un equipo con el código ${code}`,
        );
      }

      const { evaporators, condensers, planMantenimiento, ...equipmentBase } =
        dto;

      // Crear equipo base
      const equipmentData = {
        ...equipmentBase,
        areaId: finalAreaId,
        subAreaId: finalSubAreaId ?? undefined,
        code,
        status: dto.status ?? EquipmentStatus.ACTIVE,
        createdBy,
      };

      const equipment = this.equipmentRepository.create(equipmentData);
      const savedEquipment = await queryRunner.manager.save(equipment);

      // Crear componentes
      await this.createComponentsWithQueryRunner(
        queryRunner,
        savedEquipment.equipmentId,
        dto,
      );

      await queryRunner.commitTransaction();

      const fullEquipment = await this.findOne(savedEquipment.equipmentId);

      // 🔴 Evento WebSocket: equipo creado
      this.notificationsGateway.server.emit('equipment.created', fullEquipment);

      return fullEquipment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creando equipo: ${error.message}`, error.stack);

      // Manejar errores de constraint UNIQUE
      const constraintResult =
        await this.sequenceHelper.handleUniqueConstraintError(error);
      if (!constraintResult.handled && constraintResult.suggestion) {
        throw new BadRequestException(
          `${constraintResult.message}. ${constraintResult.suggestion}`,
        );
      }

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Error al crear el equipo. Por favor, intente nuevamente.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Asegura que la secuencia esté lista para insertar
   */
  private async ensureSequenceIsReady(): Promise<void> {
    try {
      await this.fixSequenceIfNeeded();
    } catch (error) {
      this.logger.warn(`No se pudo verificar secuencia: ${error.message}`);
    }
  }

  private async validateCategoryAndAirConditionerType(
    dto: CreateEquipmentDto | UpdateEquipmentDto,
    currentCategory?: ServiceCategory,
    currentAirTypeId?: number | null, // 👈 NUEVO PARÁMETRO
  ): Promise<void> {
    const finalCategory =
      dto.category !== undefined ? dto.category : currentCategory;

    if (!finalCategory) {
      throw new BadRequestException('Categoria es requerida');
    }

    if (finalCategory === ServiceCategory.AIRES_ACONDICIONADOS) {
      // 👈 USAR EL ACTUAL SI EL DTO NO LO TRAE
      const acTypeId =
        dto.airConditionerTypeId !== undefined
          ? dto.airConditionerTypeId
          : currentAirTypeId;

      if (!acTypeId) {
        throw new BadRequestException(
          'Tipo de aire requerido para equipos de aire acondicionado',
        );
      }

      const acType = await this.acTypeRepository.findOne({
        where: { id: acTypeId },
      });

      if (!acType) {
        throw new BadRequestException('Tipo de aire no existe');
      }

      return;
    }

    if (dto.airConditionerTypeId != null) {
      throw new BadRequestException(
        'Solo aires acondicionados pueden tener tipo de aire',
      );
    }
  }

  private async createComponentsWithQueryRunner(
    queryRunner: any,
    equipmentId: number,
    dto: CreateEquipmentDto,
  ): Promise<void> {
    // Validar cantidad según tipo de aire (solo si es aire acondicionado)
    await this.validateEvapCondComponentsForAirType({
      category: dto.category,
      airConditionerTypeId: dto.airConditionerTypeId,
      evaporators: dto.evaporators,
      condensers: dto.condensers,
    });

    // Crear evaporadores y sus motores
    if (dto.evaporators?.length) {
      await this.createEvaporators(queryRunner, equipmentId, dto.evaporators);
    }

    // Crear condensadoras, sus motores y compresores
    if (dto.condensers?.length) {
      await this.createCondensers(queryRunner, equipmentId, dto.condensers);
    }

    // Crear plan de mantenimiento si existe
    if (dto.planMantenimiento) {
      await this.createMaintenancePlan(
        queryRunner,
        equipmentId,
        dto.planMantenimiento,
      );
    }
  }

  private async createEvaporators(
    queryRunner: any,
    equipmentId: number,
    evaporators: any[],
  ): Promise<void> {
    for (const evapDto of evaporators) {
      const { motors, ...evapData } = evapDto;

      const evaporator = this.evaporatorRepository.create({
        ...evapData,
        airConditionerTypeEvapId:
          evapData.airConditionerTypeEvapId ||
          evapData.airConditionerTypeEvapId,
        equipmentId,
      });

      const savedEvaporator = await queryRunner.manager.save(evaporator);

      if (motors?.length) {
        const evaporatorMotors = motors.map((motorDto) =>
          this.motorRepository.create({
            ...motorDto,
            evaporatorId: savedEvaporator.id,
            evaporator: savedEvaporator,
          }),
        );

        await queryRunner.manager.save(EquipmentMotor, evaporatorMotors);
      }
    }
  }

  private async createCondensers(
    queryRunner: any,
    equipmentId: number,
    condensers: any[],
  ): Promise<void> {
    for (const condDto of condensers) {
      const { motors, compressors, ...condData } = condDto;

      const condenser = this.condenserRepository.create({
        ...condData,
        equipmentId,
      });

      const savedCondenser = await queryRunner.manager.save(condenser);

      if (motors?.length) {
        const condenserMotors = motors.map((motorDto) =>
          this.motorRepository.create({
            ...motorDto,
            condenserId: savedCondenser.id,
            condenser: savedCondenser,
          }),
        );

        await queryRunner.manager.save(EquipmentMotor, condenserMotors);
      }

      if (compressors?.length) {
        const condenserCompressors = compressors.map((compressorDto) =>
          this.compressorRepository.create({
            ...compressorDto,
            condenserId: savedCondenser.id,
            condenser: savedCondenser,
          }),
        );

        await queryRunner.manager.save(
          EquipmentCompressor,
          condenserCompressors,
        );
      }
    }
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private diffEnDias(fechaObjetivo: Date, hoy: Date): number {
    const msPorDia = 1000 * 60 * 60 * 24;
    return Math.round(
      (this.startOfDay(fechaObjetivo).getTime() -
        this.startOfDay(hoy).getTime()) /
        msPorDia,
    );
  }

  private normalizePlanData(
    planData: PlanMantenimientoDto,
  ): Partial<PlanMantenimiento> {
    if (!planData) return {};

    const { fechaProgramada, diaDelMes, ...rest } = planData;

    return {
      ...rest,
      // 🔧 Asegurar que diaDelMes se pase correctamente
      diaDelMes: diaDelMes !== undefined ? diaDelMes : undefined,
      fechaProgramada:
        typeof fechaProgramada === 'string'
          ? new Date(fechaProgramada)
          : fechaProgramada,
    };
  }

  private async createMaintenancePlan(
    queryRunner: any,
    equipmentId: number,
    planData: PlanMantenimientoDto,
  ): Promise<void> {
    const validateInterval = (
      unidad: UnidadFrecuencia,
      intervalo: number,
    ): boolean => {
      if (!unidad || !intervalo) return true;

      switch (unidad) {
        case UnidadFrecuencia.DIA:
          return intervalo >= 1 && intervalo <= 365;
        case UnidadFrecuencia.SEMANA:
          return intervalo >= 1 && intervalo <= 52;
        case UnidadFrecuencia.MES:
          return intervalo >= 1 && intervalo <= 12;
        default:
          return true;
      }
    };

    // Validar el intervalo según la unidad de frecuencias
    if (planData.unidadFrecuencia && planData.diaDelMes) {
      const isValid = validateInterval(
        planData.unidadFrecuencia,
        planData.diaDelMes,
      );

      if (!isValid) {
        let errorMsg = 'Intervalo inválido: ';
        switch (planData.unidadFrecuencia) {
          case UnidadFrecuencia.DIA:
            errorMsg += 'Para DÍA el intervalo debe estar entre 1 y 365';
            break;
          case UnidadFrecuencia.SEMANA:
            errorMsg += 'Para SEMANA el intervalo debe estar entre 1 y 52';
            break;
          case UnidadFrecuencia.MES:
            errorMsg += 'Para MES el intervalo debe estar entre 1 y 12';
            break;
        }
        throw new BadRequestException(errorMsg);
      }
    }

    const existing = await queryRunner.manager.findOne(PlanMantenimiento, {
      where: { equipmentId },
    });

    const normalized = this.normalizePlanData(planData);

    if (existing) {
      const merged = this.planMantenimientoRepository.merge(
        existing,
        normalized,
      );
      await queryRunner.manager.save(merged);
      return;
    }

    const planMantenimiento = this.planMantenimientoRepository.create({
      ...normalized,
      equipmentId,
    });

    try {
      await queryRunner.manager.save(planMantenimiento);
    } catch (error) {
      this.logger.error(
        `Error guardando plan para equipo ${equipmentId}: ${error.message}`,
        error.stack,
      );

      const existing = await queryRunner.manager.query(
        'SELECT * FROM plan_mantenimiento WHERE equipment_id = $1',
        [equipmentId],
      );
      this.logger.warn(
        `Planes existentes para equipment_id=${equipmentId}: ${JSON.stringify(existing)}`,
      );

      throw error;
    }
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  private addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);

    // Ajuste por meses cortos
    if (d.getDate() < day) {
      d.setDate(0);
    }
    return d;
  }

  private nextPlanDate(
    current: Date,
    unidad: UnidadFrecuencia,
    step: number,
  ): Date {
    if (!step || step <= 0) {
      step = 1; // Valor por defecto
    }

    switch (unidad) {
      case UnidadFrecuencia.DIA:
        return this.addDays(current, step);
      case UnidadFrecuencia.SEMANA:
        return this.addDays(current, step * 7);
      case UnidadFrecuencia.MES:
        return this.addMonths(current, step);
      default:
        return current;
    }
  }

  private generateMaintenanceDatesForYear(
    plan: PlanMantenimiento,
    year: number,
  ): Date[] {
    if (!plan || !plan.fechaProgramada || !plan.unidadFrecuencia) {
      return [];
    }

    const dates: Date[] = [];
    const unidad = plan.unidadFrecuencia;
    const step = plan.diaDelMes ?? 1;

    let current = this.startOfDay(new Date(plan.fechaProgramada));

    while (current.getFullYear() < year) {
      current = this.nextPlanDate(current, unidad, step);
    }

    while (current.getFullYear() === year) {
      dates.push(this.adjustToWorkingDay(current));
      current = this.nextPlanDate(current, unidad, step);
    }

    return dates;
  }

  private adjustToWorkingDay(date: Date): Date {
    // Normalizamos a inicio de día
    const d = this.startOfDay(date);
    // 0 = Domingo
    if (d.getDay() === 0) {
      return this.addDays(d, 1); // Pasar al lunes
    }
    return d;
  }

  // ────────────────────────────────────────────────────────────────
  // FIND (mantener los métodos existentes)
  // ────────────────────────────────────────────────────────────────

  async findAll(params?: {
    clientId?: number;
    clientIds?: number[]; // 👈 NUEVO
    areaId?: number;
    subAreaId?: number;
    search?: string;
    category?: ServiceCategory;
    status?: EquipmentStatus;
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

    if (params?.clientIds && params.clientIds.length > 0) {
      qb.andWhere('e.clientId IN (:...clientIds)', {
        clientIds: params.clientIds,
      });
    } else if (params?.clientId) {
      qb.andWhere('e.clientId = :clientId', { clientId: params.clientId });
    }

    if (params?.areaId) {
      qb.andWhere('e.areaId = :areaId', { areaId: params.areaId });
    }

    if (params?.subAreaId) {
      qb.andWhere('e.subAreaId = :subAreaId', { subAreaId: params.subAreaId });
    }

    if (params?.category) {
      qb.andWhere('e.category = :category', { category: params.category });
    }

    if (params?.status) {
      qb.andWhere('e.status = :status', { status: params.status });
    }

    if (params?.search) {
      qb.andWhere('(e.code ILIKE :search OR e.notes ILIKE :search)', {
        search: `%${params.search}%`,
      });
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

    if (!eq) {
      throw new NotFoundException(`Equipo ${id} no encontrado`);
    }

    return eq;
  }

  async findByIds(ids: number[]): Promise<Equipment[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    return await this.equipmentRepository.find({
      where: { equipmentId: In(ids) },
      relations: ['client', 'area', 'subArea'],
    });
  }

  // ────────────────────────────────────────────────────────────────
  // UPDATE - Con transacción
  // ────────────────────────────────────────────────────────────────

  async update(
    id: number,
    dto: UpdateEquipmentDto,
    updatedBy?: string,
  ): Promise<Equipment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Obtener equipo existente (con relaciones necesarias)
      let equipment = await this.findOne(id);

      // Validar y actualizar cliente si cambia
      if (dto.clientId !== undefined && dto.clientId !== equipment.clientId) {
        await this.validateAndUpdateClient(equipment, dto.clientId);
      }

      // Manejar cambio de ubicación (área/subárea) y posible recálculo de código
      const locationChanged = await this.handleLocationUpdate(
        equipment,
        dto,
        queryRunner,
      );

      // ────────────────────────────────────────────────
      // Actualizar campos simples primero (incluye airConditionerTypeId)
      // ────────────────────────────────────────────────
      const { evaporators, condensers, planMantenimiento, ...rest } = dto;

      Object.entries(rest).forEach(([key, value]) => {
        if (value !== undefined) {
          // Asignación segura
          if (key in equipment) {
            (equipment as any)[key] = value;
          }
        }
      });

      if (updatedBy) {
        equipment.updatedBy = updatedBy;
      }

      // ────────────────────────────────────────────────
      // Ahora manejar categoría y tipo de aire (después de los campos básicos)
      // ────────────────────────────────────────────────
      await this.validateCategoryAndAirConditionerType(
        dto,
        equipment.category,
        equipment.airConditionerTypeId,
      );
      await this.handleCategoryUpdate(equipment, dto);

      // Si se cambió el tipo de aire, cargar la entidad para la respuesta
      if (
        dto.airConditionerTypeId !== undefined &&
        equipment.airConditionerTypeId
      ) {
        const acType = await this.acTypeRepository.findOne({
          where: { id: equipment.airConditionerTypeId },
        });
        if (acType) {
          equipment.airConditionerType = acType;
        }
      }

      // Guardar cambios del equipo base
      await queryRunner.manager.save(Equipment, equipment);

      // Actualizar componentes si fueron enviados
      if (
        evaporators !== undefined ||
        condensers !== undefined ||
        planMantenimiento !== undefined
      ) {
        await this.updateComponentsWithQueryRunner(
          queryRunner,
          id,
          dto,
          equipment,
        );
      }

      await queryRunner.commitTransaction();

      const fullEquipment = await this.findOne(id);

      // Evento WebSocket
      this.notificationsGateway.server.emit('equipment.updated', fullEquipment);

      return fullEquipment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error actualizando equipo ${id}: ${error.message}`,
        error.stack,
      );

      const constraintResult =
        await this.sequenceHelper.handleUniqueConstraintError(error);
      if (!constraintResult.handled && constraintResult.suggestion) {
        throw new BadRequestException(
          `${constraintResult.message}. ${constraintResult.suggestion}`,
        );
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async validateAndUpdateClient(
    equipment: Equipment,
    clientId: number,
  ): Promise<void> {
    const client = await this.clientRepository.findOne({
      where: { idCliente: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Cliente ${clientId} no encontrado`);
    }

    equipment.clientId = clientId;
    equipment.client = client;
  }
  private async handleLocationUpdate(
    equipment: Equipment,
    dto: UpdateEquipmentDto,
    queryRunner: any,
  ): Promise<boolean> {
    const incomingArea = dto.areaId;
    const incomingSub = dto.subAreaId;

    // Si no viene nada de ubicación, no tocamos nada
    if (incomingArea === undefined && incomingSub === undefined) {
      return false;
    }

    let finalArea = incomingArea ?? equipment.areaId ?? null;
    let finalSub = incomingSub ?? equipment.subAreaId ?? null;

    // Validar subárea si se proporciona
    if (finalSub != null) {
      const sub = await this.subAreaRepository.findOne({
        where: { idSubArea: finalSub },
      });

      if (!sub) {
        throw new NotFoundException('Subárea no encontrada');
      }

      if (finalArea != null && finalArea !== sub.areaId) {
        throw new BadRequestException('Área no coincide con subárea');
      }

      // Aseguramos coherencia: el área es la del registro de subárea
      finalArea = sub.areaId;
    } else if (finalArea != null) {
      const area = await this.areaRepository.findOne({
        where: { idArea: finalArea },
      });

      if (!area) {
        throw new NotFoundException('Área no encontrada');
      }
    }

    const changed =
      finalArea !== equipment.areaId || finalSub !== equipment.subAreaId;

    if (changed) {
      // Actualizamos IDs
      equipment.areaId = finalArea ?? undefined;
      equipment.subAreaId = finalSub ?? undefined;

      // 🔹 Actualizar también las RELACIONES, cuidando los tipos (Area | undefined)
      if (finalArea != null) {
        const newArea = await this.areaRepository.findOne({
          where: { idArea: finalArea },
        });
        if (!newArea) {
          throw new NotFoundException('Área no encontrada');
        }
        equipment.area = newArea; // Tipo estrechado a Area, sin null
      } else {
        equipment.area = undefined;
      }

      if (finalSub != null) {
        const newSubArea = await this.subAreaRepository.findOne({
          where: { idSubArea: finalSub },
        });
        if (!newSubArea) {
          throw new NotFoundException('Subárea no encontrada');
        }
        equipment.subArea = newSubArea; // Tipo estrechado a SubArea, sin null
      } else {
        equipment.subArea = undefined;
      }

      // Recalcular código según nueva ubicación
      if (finalArea != null) {
        const newCode = await this.generateEquipmentCode(
          equipment.client,
          finalArea,
          finalSub,
          equipment.category,
        );

        const existingWithCode = await this.equipmentRepository.findOne({
          where: { code: newCode, equipmentId: Not(equipment.equipmentId) },
        });

        if (existingWithCode) {
          throw new BadRequestException(
            `Ya existe un equipo con el código ${newCode}`,
          );
        }

        equipment.code = newCode;
      }
    }

    return changed;
  }

  private async handleCategoryUpdate(
    equipment: Equipment,
    dto: UpdateEquipmentDto,
  ): Promise<void> {
    // Actualizar categoría si viene
    if (dto.category !== undefined) {
      equipment.category = dto.category;
    }

    const finalCategory = equipment.category; // ya actualizada

    // Manejo del tipo de aire
    if (dto.airConditionerTypeId !== undefined) {
      // Validación de categoría
      if (finalCategory !== ServiceCategory.AIRES_ACONDICIONADOS) {
        throw new BadRequestException(
          'Solo equipos de aires acondicionados pueden tener tipo de aire',
        );
      }

      // Asignar el nuevo ID
      equipment.airConditionerTypeId = dto.airConditionerTypeId;

      // Opcional: precargar la relación para la respuesta inmediata
      // (aunque findOne lo hará de nuevo, esto ayuda en consistencia)
      if (dto.airConditionerTypeId !== null) {
        const acType = await this.acTypeRepository.findOne({
          where: { id: dto.airConditionerTypeId },
        });
        if (!acType) {
          throw new BadRequestException(
            `Tipo de aire ${dto.airConditionerTypeId} no encontrado`,
          );
        }
        equipment.airConditionerType = acType;
      } else {
        equipment.airConditionerType = undefined;
      }
    }
    // Si la categoría ya no es de aires y no se envió tipo → limpiar
    else if (finalCategory !== ServiceCategory.AIRES_ACONDICIONADOS) {
      equipment.airConditionerTypeId = undefined;
      equipment.airConditionerType = undefined;
    }
  }

  private async updateComponentsWithQueryRunner(
    queryRunner: any,
    equipmentId: number,
    dto: UpdateEquipmentDto,
    equipment?: Equipment,
  ): Promise<void> {
    const { evaporators, condensers, planMantenimiento } = dto;

    // Validar tipo de aire y cantidades
    const finalCategory = equipment?.category ?? dto.category;
    const finalAirTypeId =
      dto.airConditionerTypeId ?? equipment?.airConditionerTypeId;

    if (
      finalCategory &&
      finalCategory === ServiceCategory.AIRES_ACONDICIONADOS
    ) {
      await this.validateEvapCondComponentsForAirType({
        category: finalCategory,
        airConditionerTypeId: finalAirTypeId,
        evaporators,
        condensers,
      });
    }

    // 1) Actualizar componentes SOLO si vienen en el DTO
    if (evaporators !== undefined || condensers !== undefined) {
      // Obtener IDs existentes
      const existingEvaporators = await this.evaporatorRepository.find({
        where: { equipmentId },
        select: ['id'],
      });

      const existingCondensers = await this.condenserRepository.find({
        where: { equipmentId },
        select: ['id'],
      });

      // Borrar motores/compresores de esos componentes
      if (existingEvaporators.length > 0) {
        const evaporatorIds = existingEvaporators.map((ev) => ev.id);
        await queryRunner.manager.delete(EquipmentMotor, {
          evaporatorId: In(evaporatorIds),
        });
      }

      if (existingCondensers.length > 0) {
        const condenserIds = existingCondensers.map((cond) => cond.id);
        await queryRunner.manager.delete(EquipmentMotor, {
          condenserId: In(condenserIds),
        });
        await queryRunner.manager.delete(EquipmentCompressor, {
          condenserId: In(condenserIds),
        });
      }

      // Borrar evaporadores/condensadores existentes
      await queryRunner.manager.delete(EquipmentEvaporator, { equipmentId });
      await queryRunner.manager.delete(EquipmentCondenser, { equipmentId });

      // Crear nuevos (con el campo airConditionerTypeEvapId incluido)
      if (evaporators?.length) {
        await this.createEvaporators(queryRunner, equipmentId, evaporators);
      }

      if (condensers?.length) {
        await this.createCondensers(queryRunner, equipmentId, condensers);
      }
    }

    // 2) Plan de mantenimiento SOLO si el DTO lo trae
    if (planMantenimiento !== undefined) {
      if (!planMantenimiento) {
        // Si viene null o falsy explícito, borramos el plan
        await queryRunner.manager.delete(PlanMantenimiento, { equipmentId });
      } else {
        // Si viene objeto, hacemos upsert con createMaintenancePlan
        await this.createMaintenancePlan(
          queryRunner,
          equipmentId,
          planMantenimiento,
        );
      }
    }
  }

  // ────────────────────────────────────────────────────────────────
  // DELETE
  // ────────────────────────────────────────────────────────────────

  async remove(id: number): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar que el equipo existe
      const eq = await this.findOne(id);

      // Eliminar imágenes asociadas
      await this.imagesService.deleteByEquipment(id);

      // Eliminar documentos PDF asociados (físico + BD)
      await this.equipmentDocumentsServices.deleteDocument(id);

      // Eliminar equipo (las relaciones cascade deberían eliminar el resto)
      await queryRunner.manager.remove(Equipment, eq);

      await queryRunner.commitTransaction();
      this.notificationsGateway.server.emit('equipment.deleted', { id });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error eliminando equipo ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ────────────────────────────────────────────────────────────────
  // MÉTODOS PARA RELACIÓN CON ÓRDENES
  // ────────────────────────────────────────────────────────────────

  async getEquipmentWorkOrders(equipmentId: number): Promise<any[]> {
    const equipment = await this.equipmentRepository.findOne({
      where: { equipmentId },
      relations: [
        'equipmentWorkOrders',
        'equipmentWorkOrders.workOrder',
        'equipmentWorkOrders.workOrder.service',
        'equipmentWorkOrders.workOrder.cliente',
        'equipmentWorkOrders.workOrder.technicians', // Cambiar 'tecnico' por 'technicians'
        'equipmentWorkOrders.workOrder.technicians.technician', // Añadir esta relación
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
        technicians:
          ewo.workOrder.technicians?.map((tech) => ({
            id: tech.id,
            tecnicoId: tech.tecnicoId,
            isLeader: tech.isLeader,
            technician: tech.technician,
          })) || [],
      },
    }));
  }

  // ────────────────────────────────────────────────────────────────
  // MÉTODOS UTILITARIOS Y DE DIAGNÓSTICO
  // ────────────────────────────────────────────────────────────────

  async countByClient(clientId: number): Promise<number> {
    return await this.equipmentRepository.count({
      where: { clientId },
    });
  }

  async countByArea(areaId: number): Promise<number> {
    return await this.equipmentRepository.count({
      where: { areaId },
    });
  }

  async countBySubArea(subAreaId: number): Promise<number> {
    return await this.equipmentRepository.count({
      where: { subAreaId },
    });
  }

  async getEquipmentByCode(code: string): Promise<Equipment> {
    const equipment = await this.equipmentRepository.findOne({
      where: { code },
      relations: ['client', 'area', 'subArea', 'images'],
    });

    if (!equipment) {
      throw new NotFoundException(`Equipo con código ${code} no encontrado`);
    }

    return equipment;
  }

  async updateStatus(
    id: number,
    status: EquipmentStatus,
    notes?: string,
  ): Promise<Equipment> {
    const equipment = await this.findOne(id);

    equipment.status = status;

    if (notes) {
      equipment.notes = equipment.notes
        ? `${equipment.notes}\n${new Date().toISOString()}: ${notes}`
        : `${new Date().toISOString()}: ${notes}`;
    }

    const updated = await this.equipmentRepository.save(equipment);

    // 🔴 Evento WebSocket: solo cambio de estado
    this.notificationsGateway.server.emit('equipment.statusUpdated', updated);
    // Opcionalmente también:
    this.notificationsGateway.server.emit('equipment.updated', updated);

    return updated;
  }

  async getStatistics(clientId?: number): Promise<any> {
    const query = this.equipmentRepository.createQueryBuilder('e');

    if (clientId) {
      query.where('e.clientId = :clientId', { clientId });
    }

    const total = await query.getCount();

    const byCategory = await query
      .select('e.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('e.category')
      .getRawMany();

    const byStatus = await query
      .select('e.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('e.status')
      .getRawMany();

    return {
      total,
      byCategory: byCategory.reduce((acc, curr) => {
        acc[curr.category] = parseInt(curr.count);
        return acc;
      }, {}),
      byStatus: byStatus.reduce((acc, curr) => {
        acc[curr.status] = parseInt(curr.count);
        return acc;
      }, {}),
    };
  }

  /**
   * Método público para corregir secuencias manualmente
   */
  async fixSequences(): Promise<{
    corrected: boolean;
    details: SequenceCorrection[];
  }> {
    const corrections: SequenceCorrection[] = [];

    try {
      // Corregir secuencia principal
      const mainSequence = await this.fixSequenceIfNeeded();
      corrections.push({
        table: this.tableName,
        corrected: mainSequence.corrected,
        message: mainSequence.message,
      });

      // Corregir secuencias relacionadas
      const relatedSequences = [
        {
          table: 'equipment_evaporators',
          idColumn: 'id',
          sequence: 'equipment_evaporators_id_seq',
        },
        {
          table: 'equipment_condensers',
          idColumn: 'id',
          sequence: 'equipment_condensers_id_seq',
        },
        {
          table: 'equipment_motors',
          idColumn: 'id',
          sequence: 'equipment_motors_id_seq',
        },
        {
          table: 'equipment_compressors',
          idColumn: 'id',
          sequence: 'equipment_compressors_id_seq',
        },
        {
          table: 'plan_mantenimiento',
          idColumn: 'id',
          sequence: 'plan_mantenimiento_id_seq',
        },
      ];

      for (const seq of relatedSequences) {
        try {
          const result = await this.sequenceHelper.checkAndFixSequence(
            seq.table,
            seq.idColumn,
            seq.sequence,
          );

          corrections.push({
            table: seq.table,
            corrected: result.corrected,
            message: result.corrected
              ? `Corregida de ${result.lastValue - 1} a ${result.maxId}`
              : 'Ya estaba sincronizada',
          });
        } catch (error: any) {
          corrections.push({
            table: seq.table,
            corrected: false,
            message: `Error: ${error.message}`,
          });
        }
      }

      const anyCorrected = corrections.some((c) => c.corrected);

      return {
        corrected: anyCorrected,
        details: corrections,
      };
    } catch (error: any) {
      this.logger.error('Error corrigiendo secuencias:', error);
      throw error;
    }
  }

  async generateAnnualMaintenanceExcelForClient(
    year: number,
    clientId: number,
  ): Promise<Buffer> {
    // 1. Equipos del cliente CON plan y categoría Aires Acondicionados
    const qb = this.equipmentRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.client', 'client')
      .leftJoinAndSelect('e.planMantenimiento', 'plan')
      .leftJoinAndSelect('e.evaporators', 'evaps')
      .leftJoinAndSelect('e.area', 'area')
      .leftJoinAndSelect('e.subArea', 'subArea')
      .where('e.clientId = :clientId', { clientId })
      .andWhere('plan.id IS NOT NULL')
      .andWhere('e.category = :cat', {
        cat: ServiceCategory.AIRES_ACONDICIONADOS,
      });

    const equipments = await qb.getMany();

    // 2. Delegar al template
    return buildAnnualMaintenancePlanExcel({ year, equipments });
  }

  async advanceMaintenancePlanFromPlanId(planId: number): Promise<void> {
    const plan = await this.planMantenimientoRepository.findOne({
      where: { id: planId },
    });

    if (!plan || !plan.unidadFrecuencia) {
      return;
    }

    const unidad = plan.unidadFrecuencia;
    const step = plan.diaDelMes ?? 1;

    const current = plan.fechaProgramada
      ? this.startOfDay(new Date(plan.fechaProgramada))
      : this.startOfDay(new Date());

    // Siguiente fecha según la unidad/step
    let next = this.nextPlanDate(current, unidad, step);

    // Ajustar domingo → lunes
    next = this.adjustToWorkingDay(next);

    plan.fechaProgramada = next;
    await this.planMantenimientoRepository.save(plan);
  }

  async advanceMaintenancePlanForEquipment(
    equipmentId: number,
  ): Promise<Equipment> {
    // 1. Buscar el plan por equipo
    const plan = await this.planMantenimientoRepository.findOne({
      where: { equipmentId },
    });

    if (!plan) {
      throw new NotFoundException(
        `No existe plan de mantenimiento para el equipo ${equipmentId}`,
      );
    }

    await this.advanceMaintenancePlanFromPlanId(plan.id);

    const updatedEquipment = await this.findOne(equipmentId);

    // 🔴 Evento WebSocket: plan de mantenimiento actualizado
    this.notificationsGateway.server.emit(
      'equipment.maintenancePlanUpdated',
      updatedEquipment,
    );

    return updatedEquipment;
  }

  async getClientEmpresaIdsForUser(userId: number): Promise<number[]> {
    const empresas = await this.clientRepository
      .createQueryBuilder('cliente')
      .innerJoin('cliente.usuariosContacto', 'usuario')
      .where('usuario.usuarioId = :userId', { userId })
      .getMany();

    return empresas.map((c) => c.idCliente);
  }

  async generateEquipmentInventoryExcel(clientId?: number): Promise<Buffer> {
    // 1. Traer equipos con relaciones necesarias
    const qb = this.equipmentRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.area', 'area')
      .leftJoinAndSelect('e.subArea', 'subArea')
      .leftJoinAndSelect('e.airConditionerType', 'acType')
      .leftJoinAndSelect('e.evaporators', 'evap')
      .leftJoinAndSelect('evap.airConditionerTypeEvap', 'evapType')
      .leftJoinAndSelect('e.condensers', 'cond')
      .where('e.category = :cat', {
        cat: ServiceCategory.AIRES_ACONDICIONADOS,
      });

    if (clientId) {
      qb.andWhere('e.clientId = :clientId', { clientId });
    }

    const equipments = await qb.getMany();

    // 2. Delegar al template
    return buildEquipmentInventoryExcel({ equipments });
  }

  async generateEquipmentHistoryPdf(equipmentId: number): Promise<Buffer> {
    try {
      // 1. Obtener el equipo con todas sus relaciones
      const equipment = await this.equipmentRepository.findOne({
        where: { equipmentId },
        relations: [
          'client',
          'area',
          'subArea',
          'airConditionerType',
          'evaporators',
          'evaporators.motors',
          'evaporators.airConditionerTypeEvap',
          'condensers',
          'condensers.motors',
          'condensers.compressors',
          'planMantenimiento',
        ],
      });

      if (!equipment) {
        throw new NotFoundException(`Equipo ${equipmentId} no encontrado`);
      }

      // 2. Obtener el historial de órdenes del equipo
      const workOrders =
        await this.workOrdersService.getWorkOrdersByEquipment(equipmentId);

      // 3. Configurar la imagen del header
      const headerImageUrl = this.configService.get<string>(
        'PDF_HEADER_IMAGE_URL',
        'https://res.cloudinary.com/dxne98os1/image/upload/v1771949437/pdf-templates/headers/production/rtrfsak5syqfclqfpq81.png',
      );

      // 4. Construir los parámetros para el template
      const params = buildEquipmentHistoryParams(equipment, workOrders, {
        headerImageUrl,
      });

      // 5. Generar el PDF
      return this.pdfService.generatePdf({
        templateName: 'equipment_history',
        params,
      });
    } catch (error) {
      this.logger.error(
        `Error generando PDF de historial: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findByClientUser(userId: number): Promise<Equipment[]> {
    try {
      const empresaIds = await this.clientRepository
        .createQueryBuilder('cliente')
        .innerJoin(
          'clientes_usuarios_contacto',
          'cuc',
          'cuc.id_cliente = cliente.idCliente',
        )
        .where('cuc.id_usuario = :userId', { userId })
        .select('cliente.idCliente', 'id')
        .getRawMany();

      if (!empresaIds || empresaIds.length === 0) {
        return [];
      }

      const ids = empresaIds.map((r) => r.id);

      // Verificar que hay equipos para esas empresas
      const equiposCount = await this.equipmentRepository
        .createQueryBuilder('eq')
        .where('eq.clientId IN (:...ids)', { ids })
        .getCount();

      if (equiposCount === 0) {
        return [];
      }

      // Traer los equipos con todas las relaciones
      const equipment = await this.equipmentRepository
        .createQueryBuilder('eq')
        .leftJoinAndSelect('eq.client', 'client')
        .leftJoinAndSelect('eq.area', 'area')
        .leftJoinAndSelect('eq.subArea', 'subArea')
        .leftJoinAndSelect('eq.airConditionerType', 'airConditionerType')
        .leftJoinAndSelect('eq.evaporators', 'evaporators')
        .leftJoinAndSelect(
          'evaporators.airConditionerTypeEvap',
          'evaporatorType',
        )
        .leftJoinAndSelect('evaporators.motors', 'evaporatorMotors')
        .leftJoinAndSelect('eq.condensers', 'condensers')
        .leftJoinAndSelect('condensers.motors', 'condenserMotors')
        .leftJoinAndSelect('condensers.compressors', 'compressors')
        .leftJoinAndSelect('eq.planMantenimiento', 'planMantenimiento')
        .leftJoinAndSelect('eq.images', 'images')
        .leftJoinAndSelect('eq.equipmentWorkOrders', 'equipmentWorkOrders')
        .leftJoinAndSelect('equipmentWorkOrders.workOrder', 'workOrder')
        .where('eq.clientId IN (:...ids)', { ids })
        .orderBy('eq.updatedAt', 'DESC')
        .getMany();
      return equipment;
    } catch (error) {
      console.error('❌ Error en findByClientUser:', error);
      console.error('❌ Stack:', error.stack);
      return [];
    }
  }
}
