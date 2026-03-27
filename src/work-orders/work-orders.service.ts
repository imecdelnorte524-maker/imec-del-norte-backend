import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource, In, IsNull } from 'typeorm';
import { WorkOrder } from './entities/work-order.entity';
import { SupplyDetail } from './entities/supply-detail.entity';
import { ToolDetail } from './entities/tool-detail.entity';
import { EquipmentWorkOrder } from './entities/equipment-work-order.entity';
import { WorkOrderTechnician } from './entities/work-order-technician.entity';
import { WorkOrderTimer } from './entities/work-order-timer.entity';
import { WorkOrderPause } from './entities/work-order-pause.entity';
import { Service } from '../services/entities/service.entity';
import { User } from '../users/entities/user.entity';
import { Supply } from '../supplies/entities/supply.entity';
import { Tool } from '../tools/entities/tool.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Client } from '../client/entities/client.entity';
import { Equipment } from '../equipment/entities/equipment.entity';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { AddSupplyDetailDto } from './dto/add-supply-detail.dto';
import { AddToolDetailDto } from './dto/add-tool-detail.dto';
import { ToolStatus, SupplyStatus, EquipmentStatus } from '../shared/index';
import { WorkOrderStatus } from '../shared/index';
import { BillingStatus } from '../shared/index';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServiceCategory } from '../shared/index';
import { PlanMantenimiento } from '../equipment/entities/plan-mantenimiento.entity';
import { CreateEmergencyOrderDto } from './dto/create-emergency-order.dto';
import { AssignTechniciansDto } from './dto/assign-technicians.dto';
import { RateTechniciansDto } from './dto/rate-technicians.dto';
import { SignWorkOrderDto } from './dto/sign-work-order.dto';
import { AcInspection } from './entities/ac-inspection.entity';
import { AcInspectionPhase, WorkOrderEvidencePhase } from '../shared/index';
import { CreateAcInspectionDto } from './dto/create-ac-inspection.dto';
import { CostStatus } from '../shared/index';
import { ConfigService } from '@nestjs/config';
import { buildInformeOrdenParams } from '../../templates/report/informe-orden-html.helper';
import {
  SendWorkOrderReportsDto,
  WorkOrderReportType,
} from './dto/send-work-order-reports.dto';
import { SendWorkOrderReportsToClientsDto } from './dto/send-work-order-reports-to-clients.dto';
import JSZip from 'jszip';
import { WorkOrderMaintenancePlan } from './entities/work-order-maintenance-plan.entity';
import { RealtimeService } from '../realtime/realtime.service';
import { Image } from '../images/entities/image.entity';
import { PdfService } from '../pdf/pdf.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class WorkOrdersService {
  constructor(
    @InjectRepository(WorkOrder)
    private workOrdersRepository: Repository<WorkOrder>,
    @InjectRepository(SupplyDetail)
    private supplyDetailsRepository: Repository<SupplyDetail>,
    @InjectRepository(ToolDetail)
    private toolDetailsRepository: Repository<ToolDetail>,
    @InjectRepository(EquipmentWorkOrder)
    private equipmentWorkOrderRepository: Repository<EquipmentWorkOrder>,
    @InjectRepository(WorkOrderTechnician)
    private workOrderTechnicianRepository: Repository<WorkOrderTechnician>,
    @InjectRepository(WorkOrderTimer)
    private workOrderTimerRepository: Repository<WorkOrderTimer>,
    @InjectRepository(WorkOrderPause)
    private workOrderPauseRepository: Repository<WorkOrderPause>,
    @InjectRepository(Service)
    private servicesRepository: Repository<Service>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Supply)
    private suppliesRepository: Repository<Supply>,
    @InjectRepository(Tool)
    private toolRepository: Repository<Tool>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
    @InjectRepository(Equipment)
    private equipmentRepository: Repository<Equipment>,
    @InjectRepository(AcInspection)
    private acInspectionRepository: Repository<AcInspection>,
    @InjectRepository(Image)
    private imageRepository: Repository<Image>,
    @InjectRepository(WorkOrderMaintenancePlan)
    private readonly woPlanRepo: Repository<WorkOrderMaintenancePlan>,
    @InjectRepository(PlanMantenimiento)
    private readonly planRepo: Repository<PlanMantenimiento>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
    private readonly pdfService: PdfService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly realtime: RealtimeService,
  ) {}

  private readonly MAX_EMAIL_ATTACHMENT_BYTES = 30 * 1024 * 1024;

  private getRoleName(currentUser: any): string {
    return currentUser?.role?.nombreRol || currentUser?.role || '';
  }

  private getColombiaTime(): Date {
    const now = new Date();
    const colombiaOffset = -5 * 60;
    const localOffset = now.getTimezoneOffset();
    const offsetDiff = colombiaOffset - localOffset;
    return new Date(now.getTime() + offsetDiff * 60000);
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private dateOnlyStr(d: Date): string {
    return this.startOfDay(d).toISOString().slice(0, 10);
  }

  private addBusinessDays(date: Date, businessDays: number): Date {
    const result = new Date(date);
    let added = 0;
    while (added < businessDays) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      if (day !== 0 && day !== 6) added++;
    }
    return result;
  }

  private calculateSupplyStatus(
    cantidad: number,
    stockMin: number = 0,
  ): SupplyStatus {
    if (cantidad === 0) return SupplyStatus.AGOTADO;
    if (stockMin > 0 && cantidad <= stockMin) return SupplyStatus.STOCK_BAJO;
    return SupplyStatus.DISPONIBLE;
  }

  private async isUserContactoOfCliente(
    userId: number,
    clienteId: number,
  ): Promise<boolean> {
    const cliente = await this.clientsRepository.findOne({
      where: { idCliente: clienteId },
      relations: ['usuariosContacto'],
    });
    if (!cliente || !cliente.usuariosContacto) return false;
    return cliente.usuariosContacto.some((user) => user.usuarioId === userId);
  }

  private getPrimerUsuarioContacto(cliente: Client): User | null {
    return cliente.usuariosContacto?.[0] || null;
  }

  private async resolveUsuarioContactoParaEmpresa(
    clienteEmpresaId: number,
  ): Promise<User> {
    const clienteEmpresa = await this.clientsRepository.findOne({
      where: { idCliente: clienteEmpresaId },
    });
    if (!clienteEmpresa) {
      throw new NotFoundException(
        `Cliente empresa ${clienteEmpresaId} no encontrado`,
      );
    }

    const clienteConContactos = await this.clientsRepository
      .createQueryBuilder('cliente')
      .innerJoinAndSelect('cliente.usuariosContacto', 'usuario')
      .where('cliente.idCliente = :clienteId', { clienteId: clienteEmpresaId })
      .getOne();

    if (!clienteConContactos?.usuariosContacto?.length) {
      throw new BadRequestException(
        `El cliente empresa ${clienteEmpresa.nombre} no tiene usuarios contacto asignados`,
      );
    }

    let usuarioSeleccionado: User | null = null;
    const nombreContacto = (clienteEmpresa.contacto || '').toLowerCase().trim();

    if (nombreContacto) {
      usuarioSeleccionado =
        clienteConContactos.usuariosContacto.find((u) => {
          const nombreCompleto = `${u.nombre} ${u.apellido}`
            .toLowerCase()
            .trim();
          return (
            nombreCompleto.includes(nombreContacto) ||
            nombreContacto.includes(nombreCompleto)
          );
        }) || null;
    }

    return usuarioSeleccionado || clienteConContactos.usuariosContacto[0];
  }

  private getNextWeekRangeFromFriday(base: Date): {
    weekStart: Date;
    weekEnd: Date;
  } {
    const hoy = this.startOfDay(base);
    const weekStart = new Date(hoy);
    weekStart.setDate(hoy.getDate() + 3);
    const weekEnd = new Date(hoy);
    weekEnd.setDate(hoy.getDate() + 8);
    return {
      weekStart: this.startOfDay(weekStart),
      weekEnd: this.startOfDay(weekEnd),
    };
  }

  private buildAutoBatchKey(params: {
    clienteEmpresaId: number;
    servicioId: number;
    weekStart: Date;
  }): string {
    return `WEEKLY:${params.clienteEmpresaId}:${params.servicioId}:${this.dateOnlyStr(params.weekStart)}`;
  }

  private async getBusyEquipmentIds(
    equipmentIds: number[],
  ): Promise<Set<number>> {
    if (!equipmentIds.length) return new Set<number>();

    const rows = await this.workOrdersRepository
      .createQueryBuilder('wo')
      .innerJoin('wo.equipmentWorkOrders', 'ewo')
      .select('ewo.equipmentId', 'equipmentId')
      .where('ewo.equipmentId IN (:...equipmentIds)', { equipmentIds })
      .andWhere('wo.estado NOT IN (:...inactive)', {
        inactive: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELED],
      })
      .getRawMany();

    return new Set(rows.map((r) => Number(r.equipmentId)));
  }

  async create(dto: CreateWorkOrderDto, currentUser: any): Promise<WorkOrder> {
    const roleName = this.getRoleName(currentUser);

    if (roleName === 'Cliente') {
      dto.clienteId = currentUser.userId;
      const empresasCliente = await this.clientsRepository
        .createQueryBuilder('cliente')
        .innerJoinAndSelect('cliente.usuariosContacto', 'usuario')
        .where('usuario.usuarioId = :userId', { userId: currentUser.userId })
        .getMany();
      if (empresasCliente.length > 0) {
        dto.clienteEmpresaId = empresasCliente[0].idCliente;
      }
    } else if (roleName === 'Administrador' || roleName === 'Secretaria') {
      if (dto.clienteEmpresaId && !dto.clienteId) {
        const empresa = await this.clientsRepository.findOne({
          where: { idCliente: dto.clienteEmpresaId },
          relations: ['usuariosContacto'],
        });
        if (!empresa) {
          throw new NotFoundException(
            `Empresa con ID ${dto.clienteEmpresaId} no encontrada`,
          );
        }
        const primerUsuarioContacto = this.getPrimerUsuarioContacto(empresa);
        if (!primerUsuarioContacto) {
          throw new BadRequestException(
            `La empresa ${empresa.nombre} no tiene usuarios contacto asignados`,
          );
        }
        dto.clienteId = primerUsuarioContacto.usuarioId;
      } else if (dto.clienteId && !dto.clienteEmpresaId) {
        const usuarioCliente = await this.usersRepository.findOne({
          where: { usuarioId: dto.clienteId },
        });
        if (!usuarioCliente) {
          throw new BadRequestException(`El usuario no existe`);
        }
        const empresasContacto = await this.clientsRepository
          .createQueryBuilder('cliente')
          .innerJoinAndSelect('cliente.usuariosContacto', 'usuario')
          .where('usuario.usuarioId = :userId', { userId: dto.clienteId })
          .getMany();
        if (empresasContacto.length > 0) {
          dto.clienteEmpresaId = empresasContacto[0].idCliente;
        }
      } else if (dto.clienteId && dto.clienteEmpresaId) {
        const empresa = await this.clientsRepository.findOne({
          where: { idCliente: dto.clienteEmpresaId },
          relations: ['usuariosContacto'],
        });
        if (!empresa) {
          throw new NotFoundException(
            `Empresa con ID ${dto.clienteEmpresaId} no encontrada`,
          );
        }
        const isContacto = await this.isUserContactoOfCliente(
          dto.clienteId,
          dto.clienteEmpresaId,
        );
        if (!isContacto) {
          throw new BadRequestException(
            `El usuario ${dto.clienteId} no es contacto de la empresa ${empresa.nombre}`,
          );
        }
      } else {
        throw new BadRequestException(
          'Debe especificar al menos clienteId o clienteEmpresaId',
        );
      }
    }

    if (!dto.clienteId) {
      throw new BadRequestException('El campo cliente_id es requerido');
    }

    const usuarioCliente = await this.usersRepository.findOne({
      where: { usuarioId: dto.clienteId },
    });
    if (!usuarioCliente) {
      throw new NotFoundException(
        `Usuario con ID ${dto.clienteId} no encontrado`,
      );
    }

    if (dto.servicioId) {
      const servicio = await this.servicesRepository.findOne({
        where: { servicioId: dto.servicioId },
      });
      if (!servicio) {
        throw new NotFoundException(
          `Servicio con ID ${dto.servicioId} no encontrado`,
        );
      }
    }

    const equipmentIds = dto.equipmentIds || [];
    if (equipmentIds.length > 0) {
      if (!dto.clienteEmpresaId) {
        throw new BadRequestException(
          'clienteEmpresaId es requerido para asignar equipos',
        );
      }
      await this.validateEquipmentAssignment(
        equipmentIds,
        dto.clienteEmpresaId,
      );
    }

    dto.estado = dto.estado || WorkOrderStatus.REQUESTED_UNASSIGNED;
    dto.estadoFacturacion = null;

    const workOrder = this.workOrdersRepository.create(dto);
    const savedWorkOrder = await this.workOrdersRepository.save(workOrder);

    if (equipmentIds.length > 0) {
      const equipmentWorkOrders = equipmentIds.map((equipmentId) =>
        this.equipmentWorkOrderRepository.create({
          workOrderId: savedWorkOrder.ordenId,
          equipmentId,
        }),
      );
      await this.equipmentWorkOrderRepository.save(equipmentWorkOrders);
    }

    if (dto.technicianIds && dto.technicianIds.length > 0) {
      await this.assignTechniciansToOrder(
        savedWorkOrder.ordenId,
        dto.technicianIds,
        dto.leaderTechnicianId,
      );
    }

    this.eventEmitter.emit('work-order.created', {
      workOrderId: savedWorkOrder.ordenId,
      clienteId: savedWorkOrder.clienteId,
      servicioId: savedWorkOrder.servicioId,
      equipmentIds,
      isEmergency: savedWorkOrder.isEmergency || false,
      createdBy: currentUser?.userId,
      userClientId: savedWorkOrder.clienteId,
    });

    const full = await this.findOne(savedWorkOrder.ordenId);
    this.realtime.emitEntityUpdate(
      'workOrders',
      'created',
      full,
      currentUser?.userId,
    );
    if (currentUser?.userId) {
      this.realtime.emitToUser(currentUser.userId, 'workOrders.created', full);
    }

    return full;
  }

  private async validateEquipmentAssignment(
    equipmentIds: number[],
    clienteEmpresaId: number,
  ): Promise<void> {
    const equipments = await this.equipmentRepository.find({
      where: { equipmentId: In(equipmentIds) },
      relations: ['client'],
    });

    if (equipments.length !== equipmentIds.length) {
      throw new NotFoundException('Uno o más equipos no fueron encontrados');
    }

    for (const equipment of equipments) {
      if (equipment.clientId !== clienteEmpresaId) {
        throw new BadRequestException(
          `El equipo ${equipment.code || equipment.equipmentId} no pertenece al cliente de la orden`,
        );
      }
    }

    const activeOrders = await this.workOrdersRepository
      .createQueryBuilder('wo')
      .innerJoinAndSelect('wo.equipmentWorkOrders', 'ewo')
      .where('ewo.equipmentId IN (:...equipmentIds)', { equipmentIds })
      .andWhere('wo.estado NOT IN (:...inactiveStatuses)', {
        inactiveStatuses: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELED],
      })
      .getMany();

    if (activeOrders.length > 0) {
      const conflictedEquipmentIds = activeOrders.flatMap((order) =>
        (order.equipmentWorkOrders || []).map((ewo) => ewo.equipmentId),
      );
      const uniqueConflicts = [...new Set(conflictedEquipmentIds)];
      throw new ConflictException(
        `Los equipos con IDs ${uniqueConflicts.join(', ')} ya están asignados a órdenes activas`,
      );
    }
  }

  async findAll(): Promise<WorkOrder[]> {
    return this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .leftJoinAndSelect('workOrder.service', 'service')
      .leftJoinAndSelect('workOrder.cliente', 'cliente')
      .leftJoinAndSelect('workOrder.clienteEmpresa', 'clienteEmpresa')
      .leftJoinAndSelect('workOrder.technicians', 'technicians')
      .leftJoinAndSelect('technicians.technician', 'technician')
      .leftJoinAndSelect('workOrder.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .leftJoinAndSelect('equipment.area', 'area')
      .leftJoinAndSelect('equipment.subArea', 'subArea')
      .leftJoinAndSelect('workOrder.supplyDetails', 'supplyDetails')
      .leftJoinAndSelect('supplyDetails.supply', 'supply')
      .leftJoinAndSelect('workOrder.toolDetails', 'toolDetails')
      .leftJoinAndSelect('toolDetails.tool', 'tool')
      .leftJoinAndSelect('workOrder.maintenanceType', 'maintenanceType')
      .leftJoinAndSelect('workOrder.timers', 'timers')
      .leftJoinAndSelect('workOrder.pauses', 'pauses')
      .leftJoinAndSelect('pauses.user', 'pauseUser')
      .leftJoinAndSelect('clienteEmpresa.usuariosContacto', 'usuariosContacto')
      .leftJoinAndSelect('workOrder.acInspections', 'acInspections')
      .leftJoinAndSelect('workOrder.images', 'images')
      .orderBy(
        `CASE
          WHEN workOrder.estado = :unassigned THEN 1
          WHEN workOrder.estado = :assigned THEN 2
          WHEN workOrder.estado = :inProgress THEN 3
          WHEN workOrder.estado = :paused THEN 4
          WHEN workOrder.estado = :completed THEN 5
          WHEN workOrder.estado = :canceled THEN 6
          ELSE 7
        END`,
        'ASC',
      )
      .addOrderBy('workOrder.fechaSolicitud', 'DESC')
      .setParameters({
        unassigned: WorkOrderStatus.REQUESTED_UNASSIGNED,
        assigned: WorkOrderStatus.REQUESTED_ASSIGNED,
        inProgress: WorkOrderStatus.IN_PROGRESS,
        paused: WorkOrderStatus.PAUSED,
        completed: WorkOrderStatus.COMPLETED,
        canceled: WorkOrderStatus.CANCELED,
      })
      .getMany();
  }

  async findOne(id: number): Promise<WorkOrder> {
    const workOrder = await this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .leftJoinAndSelect('workOrder.service', 'service')
      .leftJoinAndSelect('workOrder.cliente', 'cliente')
      .leftJoinAndSelect('workOrder.clienteEmpresa', 'clienteEmpresa')
      .leftJoinAndSelect('workOrder.technicians', 'technicians')
      .leftJoinAndSelect('technicians.technician', 'technician')
      .leftJoinAndSelect('workOrder.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .leftJoinAndSelect('equipment.area', 'area')
      .leftJoinAndSelect('equipment.subArea', 'subArea')
      .leftJoinAndSelect('workOrder.supplyDetails', 'supplyDetails')
      .leftJoinAndSelect('supplyDetails.supply', 'supply')
      .leftJoinAndSelect('workOrder.toolDetails', 'toolDetails')
      .leftJoinAndSelect('toolDetails.tool', 'tool')
      .leftJoinAndSelect('workOrder.maintenanceType', 'maintenanceType')
      .leftJoinAndSelect('workOrder.timers', 'timers')
      .leftJoinAndSelect('workOrder.pauses', 'pauses')
      .leftJoinAndSelect('pauses.user', 'pauseUser')
      .leftJoinAndSelect('workOrder.acInspections', 'acInspections')
      .leftJoinAndSelect('workOrder.images', 'images')
      .leftJoinAndSelect('clienteEmpresa.usuariosContacto', 'usuariosContacto')
      .where('workOrder.ordenId = :id', { id })
      .getOne();

    if (!workOrder) {
      throw new NotFoundException(`Orden ${id} no encontrada`);
    }

    return workOrder;
  }

  async update(
    id: number,
    updateWorkOrderDto: UpdateWorkOrderDto,
    currentUser: any,
    clientId: string,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(id);
    const currentRoleName = this.getRoleName(currentUser);
    const isAC = this.isAirConditioningService(workOrder);
    const previousStatus = workOrder.estado;

    if (
      isAC &&
      updateWorkOrderDto.estado === WorkOrderStatus.IN_PROGRESS &&
      workOrder.estado !== WorkOrderStatus.PAUSED
    ) {
      const atLeastOne = await this.isAtLeastOneAcInspectionDone(
        id,
        AcInspectionPhase.BEFORE,
      );

      if (!atLeastOne) {
        throw new BadRequestException(
          'Debe registrar al menos un registro de datos iniciales (antes) para iniciar',
        );
      }
    }

    if (isAC && updateWorkOrderDto.estado === WorkOrderStatus.COMPLETED) {
      if (!workOrder.receivedByName || !workOrder.receivedBySignatureData) {
        throw new BadRequestException(
          'Debe registrar la firma de recibido antes de completar la orden',
        );
      }

      for (const ph of [AcInspectionPhase.BEFORE, AcInspectionPhase.AFTER]) {
        const ok = await this.areAllAcInspectionsDoneForAllEquipments(id, ph);
        if (!ok) {
          throw new BadRequestException(
            `Faltan datos de inspección (${ph}) de al menos un equipo para completar la orden`,
          );
        }
      }

      for (const ph of [
        WorkOrderEvidencePhase.BEFORE,
        WorkOrderEvidencePhase.DURING,
        WorkOrderEvidencePhase.AFTER,
      ]) {
        const ok = await this.hasAcEvidenceForAllEquipments(id, ph);
        if (!ok) {
          throw new BadRequestException(
            `Faltan evidencias fotográficas (${ph}) de al menos un equipo para completar la orden`,
          );
        }
      }
    }

    if (
      workOrder.estadoFacturacion !== null &&
      workOrder.estadoFacturacion !== undefined &&
      workOrder.estadoPago === CostStatus.PAYMENTH
    ) {
      throw new BadRequestException(
        'No se puede editar una orden que ya tiene un estado de facturación asignado',
      );
    }

    if (updateWorkOrderDto.estadoFacturacion !== undefined) {
      if (
        currentRoleName !== 'Administrador' &&
        currentRoleName !== 'Secretaria'
      ) {
        throw new ForbiddenException(
          'Solo Administrador o Secretaria pueden modificar la facturación',
        );
      }
      if (workOrder.estado !== WorkOrderStatus.COMPLETED) {
        throw new BadRequestException(
          'Solo se puede facturar órdenes finalizadas',
        );
      }
      if (
        updateWorkOrderDto.estadoFacturacion !== null &&
        workOrder.technicians?.some((t) => t.rating === null)
      ) {
        throw new BadRequestException(
          'Debe calificar a todos los técnicos antes de definir la facturación',
        );
      }
    }

    if (currentRoleName === 'Técnico') {
      const isAssigned = workOrder.technicians?.some(
        (t) => t.tecnicoId === currentUser.userId,
      );
      if (!isAssigned)
        throw new ForbiddenException('No está asignado a esta orden');
    }

    if (updateWorkOrderDto.estado) {
      this.validateEstadoTransition(
        workOrder.estado,
        updateWorkOrderDto.estado,
        currentRoleName,
      );
    }

    if (
      updateWorkOrderDto.estado === WorkOrderStatus.COMPLETED &&
      (!workOrder.receivedByName || !workOrder.receivedBySignatureData)
    ) {
      throw new BadRequestException(
        'Debe registrar la firma de recibido antes de completar la orden',
      );
    }

    if (
      updateWorkOrderDto.estado === WorkOrderStatus.IN_PROGRESS &&
      !workOrder.fechaInicio
    ) {
      updateWorkOrderDto.fechaInicio = this.getColombiaTime().toISOString();
      await this.startTimer(id, currentUser.userId);
      this.eventEmitter.emit('work-order.started', {
        workOrderId: id,
        clienteId: workOrder.clienteId,
        fechaInicio: updateWorkOrderDto.fechaInicio,
        iniciadoPor: currentUser.userId,
      });
    }

    if (
      updateWorkOrderDto.estado === WorkOrderStatus.COMPLETED &&
      !workOrder.fechaFinalizacion
    ) {
      updateWorkOrderDto.fechaFinalizacion =
        this.getColombiaTime().toISOString();
      await this.stopTimer(id);
    }

    if (updateWorkOrderDto.estado === WorkOrderStatus.PAUSED) {
      await this.pauseOrder(
        id,
        currentUser.userId,
        updateWorkOrderDto.pauseObservation,
      );
    }

    if (
      workOrder.estado === WorkOrderStatus.PAUSED &&
      updateWorkOrderDto.estado === WorkOrderStatus.IN_PROGRESS
    ) {
      await this.resumeOrder(id, currentUser.userId);
    }

    let hasChanges = false;

    if (updateWorkOrderDto.equipmentIds !== undefined) {
      if (!workOrder.clienteEmpresaId)
        throw new BadRequestException('La orden no tiene cliente asignado');
      await this.updateEquipmentAssociations(
        id,
        updateWorkOrderDto.equipmentIds,
        workOrder.clienteEmpresaId,
      );
      hasChanges = true;
    }

    if (
      updateWorkOrderDto.technicianIds !== undefined &&
      (currentRoleName === 'Administrador' || currentRoleName === 'Secretaria')
    ) {
      await this.updateTechnicianAssociations(
        id,
        updateWorkOrderDto.technicianIds,
        updateWorkOrderDto.leaderTechnicianId,
      );
      hasChanges = true;
    }

    if (updateWorkOrderDto.tecnicoId !== undefined) {
      await this.updateTechnicianAssociations(
        id,
        [updateWorkOrderDto.tecnicoId],
        updateWorkOrderDto.tecnicoId,
      );
      hasChanges = true;
    }

    const {
      pauseObservation,
      equipmentIds,
      technicianIds,
      leaderTechnicianId,
      tecnicoId,
      ...directFields
    } = updateWorkOrderDto;

    if (Object.keys(directFields).length > 0) {
      await this.workOrdersRepository.update(id, directFields);
      hasChanges = true;
    }

    if (
      updateWorkOrderDto.estado === WorkOrderStatus.COMPLETED &&
      previousStatus !== WorkOrderStatus.COMPLETED
    ) {
      await this.releaseToolsForOrder(id);
    }

    if (!hasChanges) {
      throw new BadRequestException(
        'No se proporcionaron campos válidos para actualizar esta orden',
      );
    }

    const updatedWorkOrder = await this.findOne(id);

    this.eventEmitter.emit('work-order.updated', {
      ordenId: id,
      action: 'update',
      previousStatus,
    });

    if (
      updateWorkOrderDto.estado === WorkOrderStatus.COMPLETED &&
      previousStatus !== WorkOrderStatus.COMPLETED
    ) {
      this.eventEmitter.emit('work-order.completed', {
        workOrderId: id,
        fechaFinalizacion: updatedWorkOrder.fechaFinalizacion || new Date(),
        completedBy: currentUser?.userId,
        clienteId: updatedWorkOrder.clienteId,
        clienteEmpresaId: updatedWorkOrder.clienteEmpresaId,
      });
    }

    if (
      updateWorkOrderDto.estado === WorkOrderStatus.CANCELED &&
      previousStatus !== WorkOrderStatus.CANCELED
    ) {
      this.eventEmitter.emit('work-order.cancelled', {
        workOrderId: id,
        clienteId: updatedWorkOrder.clienteId,
        canceladoPor: currentUser?.userId,
      });
    }

    if (
      updateWorkOrderDto.estado &&
      updateWorkOrderDto.estado !== previousStatus
    ) {
      this.eventEmitter.emit('work-order.status-changed', {
        workOrderId: id,
        previousStatus,
        newStatus: updateWorkOrderDto.estado,
        updatedBy: currentUser?.userId,
      });
    }

    this.realtime.emitEntityUpdate(
      'workOrders',
      'updated',
      updatedWorkOrder,
      currentUser?.userId,
    );

    if (previousStatus !== updatedWorkOrder.estado) {
      this.realtime.emitEntityUpdate(
        'workOrders',
        'status-updated',
        {
          ordenId: id,
          previousStatus,
          newStatus: updatedWorkOrder.estado,
        },
        currentUser?.userId,
      );
    }

    if (updatedWorkOrder.technicians?.length) {
      const technicianIds = updatedWorkOrder.technicians.map(
        (t) => t.tecnicoId,
      );
      this.realtime.emitEntityUpdate(
        'workOrders',
        'assigned',
        {
          ordenId: id,
          technicianIds,
          leaderTechnicianId: updatedWorkOrder.technicians.find(
            (t) => t.isLeader,
          )?.tecnicoId,
        },
        currentUser?.userId,
      );
    }

    if (currentUser?.userId) {
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.updated',
        updatedWorkOrder,
      );
    }

    return updatedWorkOrder;
  }

  private async updateEquipmentAssociations(
    ordenId: number,
    equipmentIds: number[],
    clienteEmpresaId: number,
  ): Promise<void> {
    await this.equipmentWorkOrderRepository.delete({ workOrderId: ordenId });
    if (equipmentIds.length > 0) {
      await this.validateEquipmentAssignment(equipmentIds, clienteEmpresaId);
      const rows = equipmentIds.map((equipmentId) => ({
        workOrderId: ordenId,
        equipmentId,
      }));
      await this.equipmentWorkOrderRepository.save(rows);
    }
  }

  private async updateTechnicianAssociations(
    ordenId: number,
    technicianIds: number[],
    leaderTechnicianId?: number,
  ): Promise<void> {
    await this.workOrderTechnicianRepository.delete({ ordenId });
    if (technicianIds.length > 0) {
      await this.assignTechniciansToOrder(
        ordenId,
        technicianIds,
        leaderTechnicianId,
      );
    }
  }

  async cancelByClient(id: number, currentUser: any): Promise<WorkOrder> {
    const workOrder = await this.findOne(id);
    const roleName = this.getRoleName(currentUser);

    if (roleName !== 'Cliente') {
      throw new ForbiddenException('Solo un cliente puede usar este endpoint');
    }

    if (workOrder.clienteId !== currentUser.userId) {
      throw new ForbiddenException('No tiene permiso para cancelar esta orden');
    }

    if (
      workOrder.estado === WorkOrderStatus.CANCELED ||
      workOrder.estado === WorkOrderStatus.COMPLETED
    ) {
      throw new ConflictException(
        'No se puede cancelar una orden finalizada o ya cancelada',
      );
    }

    const deadline = this.addBusinessDays(workOrder.fechaSolicitud, 3);
    if (new Date() > deadline) {
      throw new ForbiddenException(
        'El tiempo para cancelar esta orden ha expirado (más de 3 días hábiles)',
      );
    }

    this.validateEstadoTransition(
      workOrder.estado,
      WorkOrderStatus.CANCELED,
      roleName,
    );

    const previousStatus = workOrder.estado;
    workOrder.estado = WorkOrderStatus.CANCELED;
    if (!workOrder.fechaFinalizacion) {
      workOrder.fechaFinalizacion = this.getColombiaTime();
    }

    await this.workOrdersRepository.save(workOrder);
    await this.stopTimer(id);

    this.eventEmitter.emit('work-order.updated', {
      ordenId: id,
      action: 'cancel',
    });

    const updated = await this.findOne(id);

    this.realtime.emitEntityUpdate(
      'workOrders',
      'updated',
      updated,
      currentUser?.userId,
    );
    this.realtime.emitEntityUpdate(
      'workOrders',
      'status-updated',
      {
        ordenId: id,
        previousStatus,
        newStatus: WorkOrderStatus.CANCELED,
      },
      currentUser?.userId,
    );

    if (currentUser?.userId) {
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.updated',
        updated,
      );
    }

    return updated;
  }

  async remove(id: number, currentUser?: any): Promise<void> {
    const workOrder = await this.findOne(id);

    if (
      workOrder.estado === WorkOrderStatus.COMPLETED ||
      workOrder.estado === WorkOrderStatus.IN_PROGRESS
    ) {
      throw new ConflictException(
        'No se puede eliminar una orden finalizada o en proceso',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const supplyDetails = await this.supplyDetailsRepository.find({
        where: { ordenId: id },
        relations: ['supply'],
      });

      for (const detail of supplyDetails) {
        const inventory = detail.supply?.inventories?.[0];
        if (inventory) {
          const cantidadUsada = Number(detail.cantidadUsada);
          inventory.cantidadActual =
            Number(inventory.cantidadActual) + cantidadUsada;
          await queryRunner.manager.save(inventory);
          const estado = this.calculateSupplyStatus(
            inventory.cantidadActual,
            detail.supply?.stockMin || 0,
          );
          await queryRunner.manager.update(
            Supply,
            { insumoId: detail.insumoId },
            { estado },
          );
        }
      }

      const toolDetails = await this.toolDetailsRepository.find({
        where: { ordenId: id },
      });
      for (const detail of toolDetails) {
        await queryRunner.manager.update(
          Tool,
          { herramientaId: detail.herramientaId },
          { estado: ToolStatus.DISPONIBLE },
        );
      }

      await queryRunner.manager.delete(SupplyDetail, { ordenId: id });
      await queryRunner.manager.delete(ToolDetail, { ordenId: id });
      await queryRunner.manager.delete(EquipmentWorkOrder, { workOrderId: id });
      await queryRunner.manager.delete(WorkOrderTechnician, { ordenId: id });
      await queryRunner.manager.delete(WorkOrderTimer, { ordenId: id });
      await queryRunner.manager.delete(WorkOrderPause, { ordenId: id });
      await queryRunner.manager.delete(WorkOrderMaintenancePlan, {
        ordenId: id,
      });
      await queryRunner.manager.remove(workOrder);

      await queryRunner.commitTransaction();

      this.eventEmitter.emit('work-order.deleted', { ordenId: id });

      this.realtime.emitEntityUpdate(
        'workOrders',
        'deleted',
        { ordenId: id },
        currentUser?.userId,
      );

      if (currentUser?.userId) {
        this.realtime.emitToUser(currentUser.userId, 'workOrders.deleted', {
          ordenId: id,
        });
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async assignTechnician(
    ordenId: number,
    tecnicoId: number,
    currentUser?: any,
  ): Promise<WorkOrder> {
    const tecnico = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.usuarioId = :id', { id: tecnicoId })
      .andWhere('role.nombreRol = :rol', { rol: 'Técnico' })
      .getOne();

    if (!tecnico) {
      throw new NotFoundException(
        `Técnico con ID ${tecnicoId} no encontrado o no tiene rol Técnico`,
      );
    }

    const dto: AssignTechniciansDto = {
      technicianIds: [tecnicoId],
      leaderTechnicianId: tecnicoId,
    };
    const updated = await this.assignTechnicians(ordenId, dto, currentUser);

    this.eventEmitter.emit('work-order.updated', {
      ordenId,
      action: 'assignTechnician',
    });

    return updated;
  }

  async assignTechnicians(
    ordenId: number,
    dto: AssignTechniciansDto,
    currentUser?: any,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);

    const technicians = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.usuarioId IN (:...ids)', { ids: dto.technicianIds })
      .andWhere('role.nombreRol = :rol', { rol: 'Técnico' })
      .getMany();

    if (technicians.length !== dto.technicianIds.length) {
      throw new NotFoundException(
        'Uno o más técnicos no existen o no tienen rol Técnico',
      );
    }

    if (
      dto.leaderTechnicianId &&
      !dto.technicianIds.includes(dto.leaderTechnicianId)
    ) {
      throw new BadRequestException(
        'El líder debe estar en la lista de técnicos',
      );
    }

    await this.workOrderTechnicianRepository.delete({ ordenId });

    const technicianAssociations = dto.technicianIds.map((tecnicoId) =>
      this.workOrderTechnicianRepository.create({
        ordenId,
        tecnicoId,
        isLeader: tecnicoId === dto.leaderTechnicianId,
      }),
    );
    await this.workOrderTechnicianRepository.save(technicianAssociations);

    const nuevoEstado =
      workOrder.estado === WorkOrderStatus.REQUESTED_UNASSIGNED
        ? WorkOrderStatus.REQUESTED_ASSIGNED
        : workOrder.estado;

    await this.workOrdersRepository.update(ordenId, { estado: nuevoEstado });

    const updated = await this.findOne(ordenId);

    this.eventEmitter.emit('work-order.assigned', {
      workOrderId: updated.ordenId,
      technicianIds: dto.technicianIds,
      leaderTechnicianId: dto.leaderTechnicianId,
      clienteId: updated.clienteId,
      servicioId: updated.servicioId,
      assignedBy: currentUser?.userId,
    });

    this.eventEmitter.emit('work-order.updated', {
      ordenId,
      action: 'assignTechnicians',
    });

    this.realtime.emitEntityUpdate(
      'workOrders',
      'updated',
      updated,
      currentUser?.userId,
    );

    if (workOrder.estado !== nuevoEstado) {
      this.realtime.emitEntityUpdate(
        'workOrders',
        'status-updated',
        {
          ordenId,
          previousStatus: workOrder.estado,
          newStatus: nuevoEstado,
        },
        currentUser?.userId,
      );
    }

    if (currentUser?.userId) {
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.updated',
        updated,
      );
    }

    return updated;
  }

  private async assignTechniciansToOrder(
    ordenId: number,
    technicianIds: number[],
    leaderTechnicianId?: number,
  ): Promise<void> {
    const technicians = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.usuarioId IN (:...ids)', { ids: technicianIds })
      .andWhere('role.nombreRol = :rol', { rol: 'Técnico' })
      .getMany();

    if (technicians.length !== technicianIds.length) {
      throw new NotFoundException(
        'Uno o más técnicos no existen o no tienen rol Técnico',
      );
    }

    if (leaderTechnicianId && !technicianIds.includes(leaderTechnicianId)) {
      throw new BadRequestException(
        'El líder debe estar en la lista de técnicos',
      );
    }

    const technicianAssociations = technicianIds.map((tecnicoId) =>
      this.workOrderTechnicianRepository.create({
        ordenId,
        tecnicoId,
        isLeader: tecnicoId === leaderTechnicianId,
      }),
    );

    await this.workOrderTechnicianRepository.save(technicianAssociations);
  }

  async unassignTechnician(
    ordenId: number,
    currentUser?: any,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);

    if (!workOrder.technicians || workOrder.technicians.length === 0) {
      throw new ConflictException('La orden no tiene técnicos asignados');
    }

    if (
      workOrder.estado === WorkOrderStatus.IN_PROGRESS ||
      workOrder.estado === WorkOrderStatus.COMPLETED ||
      workOrder.estado === WorkOrderStatus.CANCELED
    ) {
      throw new ConflictException(
        'No se puede quitar el técnico de una orden en proceso, finalizada o cancelada',
      );
    }

    const previousStatus = workOrder.estado;
    const nuevoEstado =
      workOrder.estado === WorkOrderStatus.REQUESTED_ASSIGNED
        ? WorkOrderStatus.REQUESTED_UNASSIGNED
        : workOrder.estado;

    await this.workOrderTechnicianRepository.delete({ ordenId });
    await this.workOrdersRepository.update(ordenId, { estado: nuevoEstado });

    const updated = await this.findOne(ordenId);

    this.eventEmitter.emit('work-order.updated', {
      ordenId,
      action: 'unassignTechnician',
    });

    this.realtime.emitEntityUpdate(
      'workOrders',
      'updated',
      updated,
      currentUser?.userId,
    );

    if (previousStatus !== nuevoEstado) {
      this.realtime.emitEntityUpdate(
        'workOrders',
        'status-updated',
        {
          ordenId,
          previousStatus,
          newStatus: nuevoEstado,
        },
        currentUser?.userId,
      );
    }

    if (currentUser?.userId) {
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.updated',
        updated,
      );
    }

    return updated;
  }

  async unassignAllTechnicians(
    ordenId: number,
    currentUser?: any,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);

    if (!workOrder.technicians || workOrder.technicians.length === 0) {
      throw new ConflictException('La orden no tiene técnicos asignados');
    }

    if (
      workOrder.estado === WorkOrderStatus.IN_PROGRESS ||
      workOrder.estado === WorkOrderStatus.COMPLETED ||
      workOrder.estado === WorkOrderStatus.CANCELED
    ) {
      throw new ConflictException(
        'No se puede quitar los técnicos de una orden en proceso, finalizada o cancelada',
      );
    }

    const previousStatus = workOrder.estado;
    await this.workOrderTechnicianRepository.delete({ ordenId });

    const nuevoEstado =
      workOrder.estado === WorkOrderStatus.REQUESTED_ASSIGNED
        ? WorkOrderStatus.REQUESTED_UNASSIGNED
        : workOrder.estado;

    await this.workOrdersRepository.update(ordenId, { estado: nuevoEstado });

    const updated = await this.findOne(ordenId);

    this.eventEmitter.emit('work-order.updated', {
      ordenId,
      action: 'unassignAllTechnicians',
    });

    this.realtime.emitEntityUpdate(
      'workOrders',
      'updated',
      updated,
      currentUser?.userId,
    );

    if (previousStatus !== nuevoEstado) {
      this.realtime.emitEntityUpdate(
        'workOrders',
        'status-updated',
        {
          ordenId,
          previousStatus,
          newStatus: nuevoEstado,
        },
        currentUser?.userId,
      );
    }

    if (currentUser?.userId) {
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.updated',
        updated,
      );
    }

    return updated;
  }

  async addEquipmentToOrder(
    ordenId: number,
    equipmentId: number,
    description?: string,
    currentUser?: any,
  ): Promise<EquipmentWorkOrder> {
    const workOrder = await this.findOne(ordenId);
    const equipment = await this.equipmentRepository.findOne({
      where: { equipmentId },
      relations: ['client'],
    });

    if (!equipment) {
      throw new NotFoundException(`Equipo ${equipmentId} no encontrado`);
    }

    if (equipment.clientId !== workOrder.clienteEmpresaId) {
      throw new BadRequestException(
        `El equipo ${equipment.code || equipmentId} no pertenece al cliente de la orden`,
      );
    }

    const activeOrders = await this.workOrdersRepository
      .createQueryBuilder('wo')
      .innerJoin('wo.equipmentWorkOrders', 'ewo')
      .where('ewo.equipmentId = :equipmentId', { equipmentId })
      .andWhere('wo.estado NOT IN (:...inactiveStatuses)', {
        inactiveStatuses: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELED],
      })
      .andWhere('wo.ordenId != :ordenId', { ordenId })
      .getMany();

    if (activeOrders.length > 0) {
      throw new ConflictException(
        `El equipo ya está asignado a la orden ${activeOrders[0].ordenId} que está activa`,
      );
    }

    const existing = await this.equipmentWorkOrderRepository.findOne({
      where: { workOrderId: ordenId, equipmentId },
    });

    if (existing) {
      throw new ConflictException('El equipo ya está asociado a esta orden');
    }

    const equipmentWorkOrder = this.equipmentWorkOrderRepository.create({
      workOrderId: ordenId,
      equipmentId,
      description,
    });

    const saved =
      await this.equipmentWorkOrderRepository.save(equipmentWorkOrder);

    this.eventEmitter.emit('work-order.equipment-added', {
      ordenId,
      equipmentId,
    });

    const updated = await this.findOne(ordenId);
    this.realtime.emitEntityUpdate(
      'workOrders',
      'updated',
      updated,
      currentUser?.userId,
    );

    if (currentUser?.userId) {
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.updated',
        updated,
      );
    }

    return saved;
  }

  async removeEquipmentFromOrder(
    ordenId: number,
    equipmentId: number,
    currentUser?: any,
  ): Promise<void> {
    const result = await this.equipmentWorkOrderRepository.delete({
      workOrderId: ordenId,
      equipmentId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('La asociación no fue encontrada');
    }

    this.eventEmitter.emit('work-order.equipment-removed', {
      ordenId,
      equipmentId,
    });

    const updated = await this.findOne(ordenId);
    this.realtime.emitEntityUpdate(
      'workOrders',
      'updated',
      updated,
      currentUser?.userId,
    );

    if (currentUser?.userId) {
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.updated',
        updated,
      );
    }
  }

  async getWorkOrdersByEquipment(equipmentId: number): Promise<WorkOrder[]> {
    const equipmentWorkOrders = await this.equipmentWorkOrderRepository.find({
      where: { equipmentId },
      relations: [
        'workOrder',
        'workOrder.service',
        'workOrder.cliente',
        'workOrder.clienteEmpresa',
        'workOrder.technicians',
        'workOrder.technicians.technician',
        'workOrder.maintenanceType',
        'workOrder.equipmentWorkOrders',
        'workOrder.equipmentWorkOrders.equipment',
        'workOrder.equipmentWorkOrders.equipment.area',
        'workOrder.equipmentWorkOrders.equipment.subArea',
      ],
      order: { createdAt: 'DESC' },
    });

    return equipmentWorkOrders.map((ewo) => ewo.workOrder);
  }

  async startTimer(ordenId: number, userId: number): Promise<WorkOrderTimer> {
    const workOrder = await this.findOne(ordenId);

    if (
      workOrder.estado === WorkOrderStatus.COMPLETED ||
      workOrder.estado === WorkOrderStatus.CANCELED
    ) {
      throw new BadRequestException(
        'No se puede iniciar el timer en una orden finalizada o cancelada',
      );
    }

    const activeTimer = await this.workOrderTimerRepository.findOne({
      where: { ordenId, endTime: IsNull() },
    });

    if (activeTimer) {
      throw new ConflictException('Ya hay un timer activo para esta orden');
    }

    const timer = this.workOrderTimerRepository.create({
      ordenId,
      startTime: this.getColombiaTime(),
      endTime: null,
      totalSeconds: 0,
    });

    return await this.workOrderTimerRepository.save(timer);
  }

  async stopTimer(ordenId: number): Promise<WorkOrderTimer> {
    const activeTimer = await this.workOrderTimerRepository.findOne({
      where: { ordenId, endTime: IsNull() },
    });

    if (!activeTimer) {
      throw new NotFoundException('No hay un timer activo para esta orden');
    }

    const endTime = this.getColombiaTime();
    const startTime = new Date(activeTimer.startTime);
    const totalSeconds = Math.floor(
      (endTime.getTime() - startTime.getTime()) / 1000,
    );

    activeTimer.endTime = endTime;
    activeTimer.totalSeconds = totalSeconds;

    return await this.workOrderTimerRepository.save(activeTimer);
  }

  async pauseOrder(
    ordenId: number,
    userId: number,
    observacion?: string,
  ): Promise<WorkOrderPause> {
    const workOrder = await this.findOne(ordenId);

    if (workOrder.estado !== WorkOrderStatus.IN_PROGRESS) {
      throw new BadRequestException('Solo se puede pausar órdenes en proceso');
    }

    const activeTimer = await this.workOrderTimerRepository.findOne({
      where: { ordenId, endTime: IsNull() },
    });

    if (activeTimer) {
      await this.stopTimer(ordenId);
    }

    const pause = this.workOrderPauseRepository.create({
      ordenId,
      userId,
      startTime: this.getColombiaTime(),
      endTime: null,
      observacion,
    });

    return await this.workOrderPauseRepository.save(pause);
  }

  async resumeOrder(ordenId: number, userId: number): Promise<WorkOrderTimer> {
    const workOrder = await this.findOne(ordenId);

    if (workOrder.estado !== WorkOrderStatus.PAUSED) {
      throw new BadRequestException('Solo se puede reanudar órdenes en pausa');
    }

    const activePause = await this.workOrderPauseRepository.findOne({
      where: { ordenId, endTime: IsNull() },
      order: { startTime: 'DESC' },
    });

    if (activePause) {
      activePause.endTime = this.getColombiaTime();
      await this.workOrderPauseRepository.save(activePause);
    }

    return await this.startTimer(ordenId, userId);
  }

  async createEmergencyOrder(
    ordenId: number,
    dto: CreateEmergencyOrderDto,
    currentUser: any,
  ): Promise<WorkOrder> {
    const originalOrder = await this.findOne(ordenId);
    const originalTechs = originalOrder.technicians || [];
    const techCount = originalTechs.length;

    if (techCount === 0) {
      throw new BadRequestException(
        'La orden original no tiene técnicos asignados',
      );
    }

    const equipmentIds = dto.equipmentIds || [];

    if (!dto.technicianIds || dto.technicianIds.length === 0) {
      throw new BadRequestException(
        'Debe especificar al menos un técnico para la orden de emergencia',
      );
    }

    const emergencyTechIds = dto.technicianIds;
    const invalidTechs = emergencyTechIds.filter(
      (id) => !originalTechs.some((t) => t.tecnicoId === id),
    );

    if (invalidTechs.length > 0) {
      throw new BadRequestException(
        `Los siguientes técnicos no están asignados a la orden original: ${invalidTechs.join(', ')}`,
      );
    }

    if (originalOrder.estado === WorkOrderStatus.IN_PROGRESS) {
      if (techCount === emergencyTechIds.length) {
        await this.pauseOrder(
          ordenId,
          currentUser.userId,
          'En pausa por orden de servicio de emergencia',
        );
        await this.workOrdersRepository.update(ordenId, {
          estado: WorkOrderStatus.PAUSED,
        });
      } else {
        await this.workOrderTechnicianRepository.delete({
          ordenId,
          tecnicoId: In(emergencyTechIds),
        });
        const removedLeaders = originalTechs.filter(
          (t) => emergencyTechIds.includes(t.tecnicoId) && t.isLeader,
        );
        if (removedLeaders.length > 0) {
          const remainingTechs = await this.workOrderTechnicianRepository.find({
            where: { ordenId },
          });
          if (remainingTechs.length > 0) {
            await this.workOrderTechnicianRepository.update(
              { ordenId },
              { isLeader: false },
            );
            await this.workOrderTechnicianRepository.update(
              { ordenId, tecnicoId: remainingTechs[0].tecnicoId },
              { isLeader: true },
            );
          }
        }
      }
    } else {
      await this.workOrderTechnicianRepository.delete({
        ordenId,
        tecnicoId: In(emergencyTechIds),
      });
      const removedLeaders = originalTechs.filter(
        (t) => emergencyTechIds.includes(t.tecnicoId) && t.isLeader,
      );
      if (removedLeaders.length > 0) {
        const remainingTechs = await this.workOrderTechnicianRepository.find({
          where: { ordenId },
        });
        if (remainingTechs.length > 0) {
          await this.workOrderTechnicianRepository.update(
            { ordenId },
            { isLeader: false },
          );
          await this.workOrderTechnicianRepository.update(
            { ordenId, tecnicoId: remainingTechs[0].tecnicoId },
            { isLeader: true },
          );
        }
      }
    }

    if (!originalOrder.clienteEmpresaId) {
      throw new BadRequestException(
        'La orden original no tiene clienteEmpresaId asignado',
      );
    }

    const leaderTechnicianId =
      dto.leaderTechnicianId &&
      emergencyTechIds.includes(dto.leaderTechnicianId)
        ? dto.leaderTechnicianId
        : emergencyTechIds[0];

    const baseComment =
      (dto.comentarios && dto.comentarios.trim()) ||
      `Emergencia creada desde orden ${ordenId}`;

    const emergencyOrderData: CreateWorkOrderDto = {
      servicioId: originalOrder.servicioId,
      clienteId: originalOrder.clienteId,
      clienteEmpresaId: originalOrder.clienteEmpresaId,
      technicianIds: emergencyTechIds,
      leaderTechnicianId,
      equipmentIds,
      comentarios: `Orden de Emergencia - ${baseComment}`,
      isEmergency: true,
      estado: WorkOrderStatus.REQUESTED_ASSIGNED,
      estadoFacturacion: null,
    };

    const emergencyOrder = await this.create(emergencyOrderData, currentUser);

    this.eventEmitter.emit('work-order.emergency-created', {
      originalOrderId: ordenId,
      emergencyOrderId: emergencyOrder.ordenId,
      userId: currentUser.userId,
      createdBy: currentUser?.userId,
    });

    const updatedOriginal = await this.findOne(ordenId);
    this.realtime.emitEntityUpdate(
      'workOrders',
      'updated',
      updatedOriginal,
      currentUser?.userId,
    );
    this.realtime.emitEntityUpdate(
      'workOrders',
      'emergency-created',
      {
        originalOrderId: ordenId,
        emergencyOrderId: emergencyOrder.ordenId,
      },
      currentUser?.userId,
    );

    if (currentUser?.userId) {
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.updated',
        updatedOriginal,
      );
    }

    return emergencyOrder;
  }

  async addSupplyDetail(
    ordenId: number,
    addSupplyDetailDto: AddSupplyDetailDto,
    currentUser?: any,
  ): Promise<SupplyDetail> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let shouldEmitStockBelowMin = false;
    let belowMinEventPayload: {
      insumoId: number;
      nombre: string;
      cantidadActual: number;
      stockMin: number;
    } | null = null;

    try {
      await this.findOne(ordenId);

      const supply = await queryRunner.manager.findOne(Supply, {
        where: { insumoId: addSupplyDetailDto.insumoId },
        relations: ['inventories', 'unidadMedida'],
      });

      if (!supply) {
        throw new NotFoundException(
          `Insumo con ID ${addSupplyDetailDto.insumoId} no encontrado`,
        );
      }

      const inventory = supply.inventories?.[0];
      if (!inventory) {
        throw new NotFoundException(
          `Inventario para insumo ID ${addSupplyDetailDto.insumoId} no encontrado`,
        );
      }

      const cantidadActual = Number(inventory.cantidadActual);
      const cantidadSolicitada = Number(addSupplyDetailDto.cantidadUsada);

      if (cantidadActual < cantidadSolicitada) {
        throw new ConflictException(
          `Stock insuficiente para ${supply.nombre}. Disponible: ${cantidadActual} ${supply.unidadMedida?.nombre || ''}, Solicitado: ${cantidadSolicitada}`,
        );
      }

      const supplyDetail = queryRunner.manager.create(SupplyDetail, {
        ordenId,
        insumoId: addSupplyDetailDto.insumoId,
        cantidadUsada: cantidadSolicitada,
        costoUnitarioAlMomento:
          addSupplyDetailDto.costoUnitarioAlMomento || supply.valorUnitario,
      });

      const savedDetail = await queryRunner.manager.save(supplyDetail);

      const nuevoStock = cantidadActual - cantidadSolicitada;
      inventory.cantidadActual = nuevoStock;
      inventory.fechaUltimaActualizacion = new Date();
      await queryRunner.manager.save(inventory);

      const estadoAnterior = supply.estado;
      const nuevoEstado = this.calculateSupplyStatus(
        nuevoStock,
        supply.stockMin,
      );

      if (nuevoEstado !== estadoAnterior) {
        await queryRunner.manager.update(
          Supply,
          { insumoId: supply.insumoId },
          { estado: nuevoEstado },
        );
        if (
          nuevoEstado === SupplyStatus.STOCK_BAJO ||
          nuevoEstado === SupplyStatus.AGOTADO
        ) {
          shouldEmitStockBelowMin = true;
          belowMinEventPayload = {
            insumoId: supply.insumoId,
            nombre: supply.nombre,
            cantidadActual: nuevoStock,
            stockMin: supply.stockMin,
          };
        }
      }

      await queryRunner.commitTransaction();

      if (shouldEmitStockBelowMin && belowMinEventPayload) {
        this.eventEmitter.emit('stock.below-min', belowMinEventPayload);
      }

      this.eventEmitter.emit('work-order.updated', {
        ordenId,
        action: 'addSupply',
      });

      const updated = await this.findOne(ordenId);
      this.realtime.emitEntityUpdate(
        'workOrders',
        'updated',
        updated,
        currentUser?.userId,
      );

      if (currentUser?.userId) {
        this.realtime.emitToUser(
          currentUser.userId,
          'workOrders.updated',
          updated,
        );
      }

      return savedDetail;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async addToolDetail(
    ordenId: number,
    addToolDetailDto: AddToolDetailDto,
    currentUser?: any,
  ): Promise<ToolDetail> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.findOne(ordenId);

      const equipment = await queryRunner.manager.findOne(Tool, {
        where: { herramientaId: addToolDetailDto.herramientaId },
      });

      if (!equipment) {
        throw new NotFoundException(
          `Equipo con ID ${addToolDetailDto.herramientaId} no encontrado`,
        );
      }

      if (equipment.estado !== ToolStatus.DISPONIBLE) {
        throw new ConflictException(
          `La herramienta no está disponible. Estado actual: ${equipment.estado}`,
        );
      }

      const equipmentDetail = queryRunner.manager.create(ToolDetail, {
        ...addToolDetailDto,
        ordenId,
      });

      const savedDetail = await queryRunner.manager.save(equipmentDetail);

      await queryRunner.manager.update(
        Tool,
        { herramientaId: addToolDetailDto.herramientaId },
        { estado: ToolStatus.EN_USO },
      );

      await queryRunner.commitTransaction();

      this.eventEmitter.emit('work-order.updated', {
        ordenId,
        action: 'addTool',
      });

      const updated = await this.findOne(ordenId);
      this.realtime.emitEntityUpdate(
        'workOrders',
        'updated',
        updated,
        currentUser?.userId,
      );

      if (currentUser?.userId) {
        this.realtime.emitToUser(
          currentUser.userId,
          'workOrders.updated',
          updated,
        );
      }

      return savedDetail;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async removeSupplyDetail(
    ordenId: number,
    detalleInsumoId: number,
    currentUser?: any,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const supplyDetail = await queryRunner.manager.findOne(SupplyDetail, {
        where: { detalleInsumoId, ordenId },
        relations: ['supply', 'supply.inventories'],
      });

      if (!supplyDetail) {
        throw new NotFoundException(
          'Detalle de insumo no encontrado en esta orden',
        );
      }

      const inventory = supplyDetail.supply?.inventories?.[0];
      if (inventory) {
        inventory.cantidadActual =
          Number(inventory.cantidadActual) + Number(supplyDetail.cantidadUsada);
        inventory.fechaUltimaActualizacion = new Date();
        await queryRunner.manager.save(inventory);
        const estado = this.calculateSupplyStatus(
          inventory.cantidadActual,
          supplyDetail.supply?.stockMin || 0,
        );
        await queryRunner.manager.update(
          Supply,
          { insumoId: supplyDetail.insumoId },
          { estado },
        );
      }

      await queryRunner.manager.remove(supplyDetail);
      await queryRunner.commitTransaction();

      this.eventEmitter.emit('work-order.updated', {
        ordenId,
        action: 'removeSupply',
      });

      const updated = await this.findOne(ordenId);
      this.realtime.emitEntityUpdate(
        'workOrders',
        'updated',
        updated,
        currentUser?.userId,
      );

      if (currentUser?.userId) {
        this.realtime.emitToUser(
          currentUser.userId,
          'workOrders.updated',
          updated,
        );
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async removeToolDetail(
    ordenId: number,
    detalleHerramientaId: number,
    currentUser?: any,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const toolDetail = await queryRunner.manager.findOne(ToolDetail, {
        where: { detalleHerramientaId, ordenId },
        relations: ['tool'],
      });

      if (!toolDetail) {
        throw new NotFoundException(
          'Detalle de herramienta no encontrado en esta orden',
        );
      }

      await queryRunner.manager.update(
        Tool,
        { herramientaId: toolDetail.herramientaId },
        { estado: ToolStatus.DISPONIBLE },
      );

      await queryRunner.manager.remove(toolDetail);
      await queryRunner.commitTransaction();

      this.eventEmitter.emit('work-order.updated', {
        ordenId,
        action: 'removeTool',
      });

      const updated = await this.findOne(ordenId);
      this.realtime.emitEntityUpdate(
        'workOrders',
        'updated',
        updated,
        currentUser?.userId,
      );

      if (currentUser?.userId) {
        this.realtime.emitToUser(
          currentUser.userId,
          'workOrders.updated',
          updated,
        );
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getWorkOrdersByStatus(estado: string): Promise<WorkOrder[]> {
    return this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .leftJoinAndSelect('workOrder.service', 'service')
      .leftJoinAndSelect('workOrder.cliente', 'cliente')
      .leftJoinAndSelect('workOrder.clienteEmpresa', 'clienteEmpresa')
      .leftJoinAndSelect('workOrder.technicians', 'technicians')
      .leftJoinAndSelect('technicians.technician', 'technician')
      .leftJoinAndSelect('workOrder.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .leftJoinAndSelect('equipment.area', 'area')
      .leftJoinAndSelect('equipment.subArea', 'subArea')
      .leftJoinAndSelect('workOrder.supplyDetails', 'supplyDetails')
      .leftJoinAndSelect('supplyDetails.supply', 'supply')
      .leftJoinAndSelect('workOrder.toolDetails', 'toolDetails')
      .leftJoinAndSelect('toolDetails.tool', 'tool')
      .leftJoinAndSelect('workOrder.maintenanceType', 'maintenanceType')
      .leftJoinAndSelect('workOrder.timers', 'timers')
      .leftJoinAndSelect('workOrder.pauses', 'pauses')
      .leftJoinAndSelect('pauses.user', 'pauseUser')
      .where('workOrder.estado = :estado', {
        estado: estado as WorkOrderStatus,
      })
      .orderBy('workOrder.fechaSolicitud', 'DESC')
      .getMany();
  }

  async getWorkOrdersByClient(clienteId: number): Promise<WorkOrder[]> {
    return this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .leftJoinAndSelect('workOrder.service', 'service')
      .leftJoinAndSelect('workOrder.cliente', 'cliente')
      .leftJoinAndSelect('workOrder.clienteEmpresa', 'clienteEmpresa')
      .leftJoinAndSelect('workOrder.technicians', 'technicians')
      .leftJoinAndSelect('technicians.technician', 'technician')
      .leftJoinAndSelect('workOrder.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .leftJoinAndSelect('equipment.area', 'area')
      .leftJoinAndSelect('equipment.subArea', 'subArea')
      .leftJoinAndSelect('workOrder.supplyDetails', 'supplyDetails')
      .leftJoinAndSelect('supplyDetails.supply', 'supply')
      .leftJoinAndSelect('workOrder.toolDetails', 'toolDetails')
      .leftJoinAndSelect('toolDetails.tool', 'tool')
      .leftJoinAndSelect('workOrder.maintenanceType', 'maintenanceType')
      .leftJoinAndSelect('workOrder.timers', 'timers')
      .leftJoinAndSelect('workOrder.pauses', 'pauses')
      .leftJoinAndSelect('pauses.user', 'pauseUser')
      .leftJoinAndSelect('clienteEmpresa.usuariosContacto', 'usuariosContacto')
      .where('workOrder.clienteId = :clienteId', { clienteId })
      .orderBy(
        `CASE
          WHEN workOrder.estado = :unassigned THEN 1
          WHEN workOrder.estado = :assigned THEN 2
          WHEN workOrder.estado = :inProgress THEN 3
          WHEN workOrder.estado = :paused THEN 4
          WHEN workOrder.estado = :completed THEN 5
          WHEN workOrder.estado = :canceled THEN 6
          ELSE 7
        END`,
        'ASC',
      )
      .addOrderBy('workOrder.fechaSolicitud', 'DESC')
      .setParameters({
        unassigned: WorkOrderStatus.REQUESTED_UNASSIGNED,
        assigned: WorkOrderStatus.REQUESTED_ASSIGNED,
        inProgress: WorkOrderStatus.IN_PROGRESS,
        paused: WorkOrderStatus.PAUSED,
        completed: WorkOrderStatus.COMPLETED,
        canceled: WorkOrderStatus.CANCELED,
      })
      .getMany();
  }

  async getWorkOrdersByTechnician(tecnicoId: number): Promise<WorkOrder[]> {
    return this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .leftJoinAndSelect('workOrder.service', 'service')
      .leftJoinAndSelect('workOrder.cliente', 'cliente')
      .leftJoinAndSelect('workOrder.clienteEmpresa', 'clienteEmpresa')
      .innerJoinAndSelect('workOrder.technicians', 'technicians')
      .innerJoinAndSelect('technicians.technician', 'technician')
      .leftJoinAndSelect('workOrder.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .leftJoinAndSelect('equipment.area', 'area')
      .leftJoinAndSelect('equipment.subArea', 'subArea')
      .leftJoinAndSelect('workOrder.supplyDetails', 'supplyDetails')
      .leftJoinAndSelect('supplyDetails.supply', 'supply')
      .leftJoinAndSelect('workOrder.toolDetails', 'toolDetails')
      .leftJoinAndSelect('toolDetails.tool', 'tool')
      .leftJoinAndSelect('workOrder.maintenanceType', 'maintenanceType')
      .leftJoinAndSelect('workOrder.timers', 'timers')
      .leftJoinAndSelect('workOrder.pauses', 'pauses')
      .leftJoinAndSelect('pauses.user', 'pauseUser')
      .leftJoinAndSelect('workOrder.acInspections', 'acInspections')
      .leftJoinAndSelect('workOrder.images', 'images')
      .where('technicians.tecnicoId = :tecnicoId', { tecnicoId })
      .orderBy(
        `CASE
          WHEN workOrder.estado = :unassigned THEN 1
          WHEN workOrder.estado = :assigned THEN 2
          WHEN workOrder.estado = :inProgress THEN 3
          WHEN workOrder.estado = :paused THEN 4
          WHEN workOrder.estado = :completed THEN 5
          WHEN workOrder.estado = :canceled THEN 6
          ELSE 7
        END`,
        'ASC',
      )
      .addOrderBy('workOrder.fechaSolicitud', 'DESC')
      .setParameters({
        unassigned: WorkOrderStatus.REQUESTED_UNASSIGNED,
        assigned: WorkOrderStatus.REQUESTED_ASSIGNED,
        inProgress: WorkOrderStatus.IN_PROGRESS,
        paused: WorkOrderStatus.PAUSED,
        completed: WorkOrderStatus.COMPLETED,
        canceled: WorkOrderStatus.CANCELED,
      })
      .getMany();
  }

  async getWorkOrdersByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<WorkOrder[]> {
    return this.workOrdersRepository.find({
      where: { fechaSolicitud: Between(startDate, endDate) },
      relations: [
        'service',
        'cliente',
        'clienteEmpresa',
        'technicians',
        'technicians.technician',
        'equipmentWorkOrders',
        'equipmentWorkOrders.equipment',
        'equipmentWorkOrders.equipment.area',
        'equipmentWorkOrders.equipment.subArea',
        'supplyDetails',
        'supplyDetails.supply',
        'toolDetails',
        'toolDetails.tool',
        'maintenanceType',
        'timers',
        'pauses',
        'pauses.user',
      ],
      order: { fechaSolicitud: 'DESC' },
    });
  }

  async getWorkOrdersByClientAndCategory(
    clienteEmpresaId: number,
    category: string,
  ): Promise<WorkOrder[]> {
    return this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .leftJoinAndSelect('workOrder.service', 'service')
      .leftJoinAndSelect('workOrder.clienteEmpresa', 'clienteEmpresa')
      .leftJoinAndSelect('workOrder.technicians', 'technicians')
      .leftJoinAndSelect('technicians.technician', 'technician')
      .leftJoinAndSelect('workOrder.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .leftJoinAndSelect('equipment.area', 'area')
      .leftJoinAndSelect('equipment.subArea', 'subArea')
      .leftJoinAndSelect('workOrder.timers', 'timers')
      .leftJoinAndSelect('workOrder.pauses', 'pauses')
      .where('workOrder.clienteEmpresaId = :clienteEmpresaId', {
        clienteEmpresaId,
      })
      .andWhere('workOrder.estado NOT IN (:...estadosExcluidos)', {
        estadosExcluidos: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELED],
      })
      .andWhere('service.categoriaServicio = :category', {
        category: category as ServiceCategory,
      })
      .orderBy('workOrder.fechaSolicitud', 'DESC')
      .getMany();
  }

  async getWorkOrderStats(): Promise<any> {
    const total = await this.workOrdersRepository.count();

    const byStatus = await this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .select('workOrder.estado', 'estado')
      .addSelect('COUNT(*)', 'count')
      .groupBy('workOrder.estado')
      .getRawMany();

    const completedThisMonth = await this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .where('workOrder.estado = :estado', {
        estado: WorkOrderStatus.COMPLETED,
      })
      .andWhere(
        'EXTRACT(MONTH FROM workOrder.fecha_finalizacion) = EXTRACT(MONTH FROM CURRENT_DATE)',
      )
      .andWhere(
        'EXTRACT(YEAR FROM workOrder.fecha_finalizacion) = EXTRACT(YEAR FROM CURRENT_DATE)',
      )
      .getCount();

    const totalRevenue = await this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .leftJoin('workOrder.service', 'service')
      .leftJoin('workOrder.supplyDetails', 'supplyDetails')
      .where('workOrder.estado = :estado', {
        estado: WorkOrderStatus.COMPLETED,
      })
      .getRawOne();

    return {
      total,
      byStatus,
      completedThisMonth,
      totalRevenue: parseFloat(totalRevenue?.total || 0),
    };
  }

  async getEmpresaIdsForClientUser(userId: number): Promise<number[]> {
    const empresas = await this.clientsRepository
      .createQueryBuilder('cliente')
      .innerJoin('cliente.usuariosContacto', 'usuario')
      .where('usuario.usuarioId = :userId', { userId })
      .getMany();
    return empresas.map((c) => c.idCliente);
  }

  async getWorkOrdersForClientUser(userId: number): Promise<WorkOrder[]> {
    const empresaIds = await this.getEmpresaIdsForClientUser(userId);
    if (!empresaIds.length) return [];

    return this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .leftJoinAndSelect('workOrder.service', 'service')
      .leftJoinAndSelect('workOrder.cliente', 'cliente')
      .leftJoinAndSelect('workOrder.clienteEmpresa', 'clienteEmpresa')
      .leftJoinAndSelect('workOrder.technicians', 'technicians')
      .leftJoinAndSelect('technicians.technician', 'technician')
      .leftJoinAndSelect('workOrder.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .leftJoinAndSelect('equipment.area', 'area')
      .leftJoinAndSelect('equipment.subArea', 'subArea')
      .leftJoinAndSelect('workOrder.supplyDetails', 'supplyDetails')
      .leftJoinAndSelect('supplyDetails.supply', 'supply')
      .leftJoinAndSelect('workOrder.toolDetails', 'toolDetails')
      .leftJoinAndSelect('toolDetails.tool', 'tool')
      .leftJoinAndSelect('workOrder.maintenanceType', 'maintenanceType')
      .leftJoinAndSelect('workOrder.timers', 'timers')
      .leftJoinAndSelect('workOrder.pauses', 'pauses')
      .leftJoinAndSelect('pauses.user', 'pauseUser')
      .leftJoinAndSelect('workOrder.acInspections', 'acInspections')
      .leftJoinAndSelect('workOrder.images', 'images')
      .leftJoinAndSelect('clienteEmpresa.usuariosContacto', 'usuariosContacto')
      .where('workOrder.clienteEmpresaId IN (:...empresaIds)', { empresaIds })
      .orderBy(
        `CASE
          WHEN workOrder.estado = :unassigned THEN 1
          WHEN workOrder.estado = :assigned THEN 2
          WHEN workOrder.estado = :inProgress THEN 3
          WHEN workOrder.estado = :paused THEN 4
          WHEN workOrder.estado = :completed THEN 5
          WHEN workOrder.estado = :canceled THEN 6
          ELSE 7
        END`,
        'ASC',
      )
      .addOrderBy('workOrder.fechaSolicitud', 'DESC')
      .setParameters({
        unassigned: WorkOrderStatus.REQUESTED_UNASSIGNED,
        assigned: WorkOrderStatus.REQUESTED_ASSIGNED,
        inProgress: WorkOrderStatus.IN_PROGRESS,
        paused: WorkOrderStatus.PAUSED,
        completed: WorkOrderStatus.COMPLETED,
        canceled: WorkOrderStatus.CANCELED,
      })
      .getMany();
  }

  async userHasAccessToEmpresa(
    userId: number,
    empresaId?: number,
  ): Promise<boolean> {
    if (!empresaId) return false;
    const empresaIds = await this.getEmpresaIdsForClientUser(userId);
    return empresaIds.includes(empresaId);
  }

  public validateEstadoTransition(
    currentEstado: WorkOrderStatus,
    newEstado: WorkOrderStatus,
    currentRole?: string,
  ): void {
    const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      [WorkOrderStatus.REQUESTED_UNASSIGNED]: [
        WorkOrderStatus.REQUESTED_ASSIGNED,
        WorkOrderStatus.CANCELED,
      ],
      [WorkOrderStatus.REQUESTED_ASSIGNED]: [
        WorkOrderStatus.IN_PROGRESS,
        WorkOrderStatus.CANCELED,
        WorkOrderStatus.REQUESTED_UNASSIGNED,
      ],
      [WorkOrderStatus.IN_PROGRESS]: [
        WorkOrderStatus.PAUSED,
        WorkOrderStatus.COMPLETED,
        WorkOrderStatus.CANCELED,
      ],
      [WorkOrderStatus.PAUSED]: [
        WorkOrderStatus.IN_PROGRESS,
        WorkOrderStatus.COMPLETED,
        WorkOrderStatus.CANCELED,
      ],
      [WorkOrderStatus.COMPLETED]: [],
      [WorkOrderStatus.CANCELED]: [],
    };

    if (
      currentEstado === WorkOrderStatus.PAUSED &&
      (newEstado === WorkOrderStatus.COMPLETED ||
        newEstado === WorkOrderStatus.CANCELED) &&
      currentRole &&
      !['Administrador', 'Secretaria'].includes(currentRole)
    ) {
      throw new BadRequestException(
        'Solo Administrador o Secretaria pueden finalizar o cancelar una orden en pausa',
      );
    }

    if (!validTransitions[currentEstado]?.includes(newEstado)) {
      throw new BadRequestException(
        `Transición de estado inválida: ${currentEstado} -> ${newEstado}`,
      );
    }
  }

  async calculateTotalCost(
    ordenId: number,
  ): Promise<{ costoTotalInsumos: number; tiempoTotal: number }> {
    const workOrder = await this.findOne(ordenId);

    const costoTotalInsumos = (workOrder.supplyDetails || []).reduce(
      (total, detail) =>
        total +
        Number(detail.cantidadUsada) *
          Number(detail.costoUnitarioAlMomento || 0),
      0,
    );

    const tiempoTotal = (workOrder.timers || []).reduce((total, timer) => {
      if (timer.endTime) return total + timer.totalSeconds;
      const now = this.getColombiaTime();
      return (
        total +
        Math.floor((now.getTime() - new Date(timer.startTime).getTime()) / 1000)
      );
    }, 0);

    return { costoTotalInsumos, tiempoTotal };
  }

  async removeInvoice(ordenId: number, currentUser?: any): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);

    workOrder.facturaPdfUrl = undefined;
    workOrder.estadoFacturacion = BillingStatus.NULL;
    workOrder.estadoPago = CostStatus.NULL;

    await this.workOrdersRepository.save(workOrder);
    const updated = await this.findOne(ordenId);

    this.realtime.emitEntityUpdate(
      'workOrders',
      'updated',
      updated,
      currentUser?.userId,
    );
    this.realtime.emitEntityDetail('workOrders', ordenId, 'invoiceRemoved', {});

    if (currentUser?.userId) {
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.updated',
        updated,
      );
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.invoiceRemoved',
        { ordenId },
      );
    }

    return updated;
  }

  async uploadInvoice(
    ordenId: number,
    invoiceUrl: string,
    estadoPago?: string,
    currentUser?: any,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);

    if (workOrder.estado !== WorkOrderStatus.COMPLETED) {
      throw new BadRequestException(
        'Solo se puede facturar una orden que esté Finalizada',
      );
    }

    if (workOrder.technicians?.length > 0) {
      const hasUnrated = workOrder.technicians.some(
        (t) => t.rating === null || t.rating === undefined,
      );
      if (hasUnrated) {
        throw new BadRequestException(
          'Debe calificar a todos los técnicos antes de subir la factura de la orden',
        );
      }
    }

    if (workOrder.facturaPdfUrl) {
      throw new BadRequestException('La orden ya tiene una factura asociada');
    }

    workOrder.facturaPdfUrl = invoiceUrl;
    workOrder.estadoFacturacion = BillingStatus.BILLED;
    workOrder.estadoPago =
      estadoPago === 'Pagado' ? CostStatus.PAYMENTH : CostStatus.NOT_PAYMENTH;

    await this.workOrdersRepository.save(workOrder);
    const updated = await this.findOne(ordenId);

    this.eventEmitter.emit('work-order.invoiced', {
      workOrderId: ordenId,
      facturaPdfUrl: invoiceUrl,
      estadoPago,
      fechaFacturacion: new Date(),
      invoicedBy: currentUser?.userId,
    });

    this.realtime.emitEntityUpdate(
      'workOrders',
      'updated',
      updated,
      currentUser?.userId,
    );
    this.realtime.emitEntityDetail('workOrders', ordenId, 'invoiceUpdated', {
      facturaPdfUrl: invoiceUrl,
      estadoPago,
    });

    if (currentUser?.userId) {
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.updated',
        updated,
      );
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.invoiceUpdated',
        updated,
      );
    }

    return updated;
  }

  async rateTechnicians(
    ordenId: number,
    dto: RateTechniciansDto,
    currentUser: any,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);
    const roleName = this.getRoleName(currentUser);

    if (!['Administrador', 'Supervisor'].includes(roleName)) {
      throw new ForbiddenException(
        'Solo Administrador o Supervisor pueden calificar técnicos',
      );
    }

    if (workOrder.estado !== WorkOrderStatus.COMPLETED) {
      throw new BadRequestException(
        'Solo se pueden calificar órdenes que estén finalizadas',
      );
    }

    const technicians = workOrder.technicians || [];
    if (technicians.length === 0) {
      throw new BadRequestException(
        'La orden no tiene técnicos asignados para calificar',
      );
    }

    const assignedIds = technicians.map((t) => t.tecnicoId);
    const bodyIds = dto.ratings.map((r) => r.technicianId);
    const uniqueBodyIds = new Set(bodyIds);

    if (
      uniqueBodyIds.size !== bodyIds.length ||
      assignedIds.length !== uniqueBodyIds.size ||
      assignedIds.some((id) => !uniqueBodyIds.has(id))
    ) {
      throw new BadRequestException(
        'Debe enviar una calificación para cada técnico asignado, sin duplicados',
      );
    }

    for (const ratingDto of dto.ratings) {
      const { technicianId, rating } = ratingDto;

      if (Math.round(rating * 2) !== rating * 2) {
        throw new BadRequestException(
          'La calificación debe estar en incrementos de 0.5',
        );
      }

      const technicianRelation =
        technicians.find((t) => t.tecnicoId === technicianId) ||
        (await this.workOrderTechnicianRepository.findOne({
          where: { ordenId, tecnicoId: technicianId },
        }));

      if (!technicianRelation) {
        throw new BadRequestException(
          `El técnico ${technicianId} no está asignado a esta orden`,
        );
      }

      if (
        technicianRelation.rating !== null &&
        technicianRelation.rating !== undefined
      ) {
        throw new ConflictException(
          `El técnico ${technicianId} ya fue calificado en esta orden`,
        );
      }

      technicianRelation.rating = rating;
      technicianRelation.ratedByUserId = currentUser.userId;
      technicianRelation.ratedAt = this.getColombiaTime();

      await this.workOrderTechnicianRepository.save(technicianRelation);
    }

    this.eventEmitter.emit('work-order.technicians-rated', {
      ordenId,
      ratedBy: currentUser.userId,
    });

    const updated = await this.findOne(ordenId);
    this.realtime.emitEntityUpdate(
      'workOrders',
      'updated',
      updated,
      currentUser?.userId,
    );
    this.realtime.emitEntityUpdate(
      'workOrders',
      'technicians-rated',
      {
        ordenId,
      },
      currentUser?.userId,
    );

    if (currentUser?.userId) {
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.updated',
        updated,
      );
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.techniciansRated',
        { ordenId },
      );
    }

    return updated;
  }

  async signReceipt(
    ordenId: number,
    dto: SignWorkOrderDto,
    currentUser: any,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);
    const roleName = this.getRoleName(currentUser);

    if (
      ![
        'Administrador',
        'Supervisor',
        'Cliente',
        'Técnico',
        'Secretaria',
      ].includes(roleName)
    ) {
      throw new ForbiddenException('No tiene permisos para firmar esta orden');
    }

    if (
      workOrder.estado === WorkOrderStatus.COMPLETED ||
      workOrder.estado === WorkOrderStatus.CANCELED
    ) {
      throw new BadRequestException(
        'No se puede firmar una orden finalizada o cancelada',
      );
    }

    workOrder.receivedByName = dto.name;
    workOrder.receivedByPosition = dto.position;
    workOrder.receivedBySignatureData = dto.signatureData;
    workOrder.receivedAt = this.getColombiaTime();

    await this.workOrdersRepository.save(workOrder);

    const updated = await this.findOne(ordenId);
    this.realtime.emitEntityUpdate(
      'workOrders',
      'updated',
      updated,
      currentUser?.userId,
    );
    this.realtime.emitEntityUpdate(
      'workOrders',
      'receipt-signed',
      {
        ordenId,
      },
      currentUser?.userId,
    );

    if (currentUser?.userId) {
      this.realtime.emitToUser(
        currentUser.userId,
        'workOrders.updated',
        updated,
      );
      this.realtime.emitToUser(currentUser.userId, 'workOrders.receiptSigned', {
        ordenId,
      });
    }

    return updated;
  }

  private isAirConditioningService(workOrder: WorkOrder): boolean {
    return (
      workOrder.service?.categoriaServicio?.toLowerCase().trim() ===
      'aires acondicionados'
    );
  }

  async createAcInspection(
    ordenId: number,
    phase: AcInspectionPhase,
    dto: CreateAcInspectionDto,
    currentUser: any,
  ) {
    const order = await this.workOrdersRepository.findOne({
      where: { ordenId },
      relations: ['equipmentWorkOrders'],
    });
    if (!order) throw new NotFoundException(`Orden ${ordenId} no encontrada`);

    if (
      [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELED].includes(
        order.estado,
      )
    ) {
      throw new BadRequestException(
        'No se pueden editar parámetros en una orden completada o cancelada',
      );
    }

    const equipmentIds = (order.equipmentWorkOrders || []).map(
      (x) => x.equipmentId,
    );
    if (!equipmentIds.includes(dto.equipmentId)) {
      throw new BadRequestException('El equipo no pertenece a esta orden');
    }

    let inspection = await this.acInspectionRepository.findOne({
      where: { workOrderId: ordenId, phase, equipmentId: dto.equipmentId },
    });

    if (inspection) {
      Object.assign(inspection, dto);
      inspection.createdByUserId =
        currentUser.userId ?? inspection.createdByUserId;
    } else {
      inspection = this.acInspectionRepository.create({
        ...dto,
        workOrderId: ordenId,
        phase,
        createdByUserId: currentUser.userId ?? null,
      });
    }

    const saved = await this.acInspectionRepository.save(inspection);

    const updated = await this.findOne(ordenId);
    this.realtime.emitEntityUpdate(
      'workOrders',
      'updated',
      updated,
      currentUser?.userId,
    );

    return saved;
  }

  private async isAtLeastOneAcInspectionDone(
    ordenId: number,
    phase: AcInspectionPhase,
  ): Promise<boolean> {
    const count = await this.acInspectionRepository.count({
      where: { workOrderId: ordenId, phase },
    });
    return count > 0;
  }

  private async getOrderEquipmentIds(ordenId: number): Promise<number[]> {
    const order = await this.workOrdersRepository.findOne({
      where: { ordenId },
      relations: ['equipmentWorkOrders'],
    });
    return (order?.equipmentWorkOrders || []).map((x) => x.equipmentId);
  }

  private async areAllAcInspectionsDoneForAllEquipments(
    ordenId: number,
    phase: AcInspectionPhase,
  ): Promise<boolean> {
    const equipmentIds = await this.getOrderEquipmentIds(ordenId);
    if (!equipmentIds.length) return false;

    const rows = await this.acInspectionRepository
      .createQueryBuilder('insp')
      .select('insp.equipmentId', 'equipmentId')
      .where('insp.workOrderId = :ordenId', { ordenId })
      .andWhere('insp.phase = :phase', { phase })
      .andWhere('insp.equipmentId IN (:...equipmentIds)', { equipmentIds })
      .groupBy('insp.equipmentId')
      .getRawMany();

    const done = new Set(rows.map((r) => Number(r.equipmentId)));
    return equipmentIds.every((id) => done.has(id));
  }

  private async hasAcEvidenceForAllEquipments(
    ordenId: number,
    phase: WorkOrderEvidencePhase,
  ): Promise<boolean> {
    const equipmentIds = await this.getOrderEquipmentIds(ordenId);
    if (!equipmentIds.length) return false;

    const rows = await this.imageRepository
      .createQueryBuilder('img')
      .select('img.equipment_id', 'equipmentId')
      .where('img.work_order_id = :ordenId', { ordenId })
      .andWhere('img.evidence_phase = :phase', { phase })
      .andWhere('img.equipment_id IN (:...equipmentIds)', { equipmentIds })
      .groupBy('img.equipment_id')
      .getRawMany();

    const has = new Set(rows.map((r) => Number(r.equipmentId)));
    return equipmentIds.every((id) => has.has(id));
  }

  async generarInformeOrden(ordenId: number): Promise<Buffer> {
    const orden = await this.findOne(ordenId);
    const headerImageUrl = this.configService.get<string>(
      'PDF_HEADER_IMAGE_URL',
      'https://res.cloudinary.com/dxne98os1/image/upload/v1771949437/pdf-templates/headers/production/rtrfsak5syqfclqfpq81.png',
    );
    const params = buildInformeOrdenParams(orden, {
      headerImageUrl,
      forClient: false,
    });
    return this.pdfService.generatePdf({
      templateName: 'orden_trabajo_interno',
      params,
    });
  }

  async generarInformeOrdenCliente(ordenId: number): Promise<Buffer> {
    const orden = await this.findOne(ordenId);
    const headerImageUrl = this.configService.get<string>(
      'PDF_HEADER_IMAGE_URL_CLIENTE',
      this.configService.get<string>(
        'PDF_HEADER_IMAGE_URL',
        'https://res.cloudinary.com/dxne98os1/image/upload/v1771949437/pdf-templates/headers/production/rtrfsak5syqfclqfpq81.png',
      ),
    );
    const params = buildInformeOrdenParams(orden, {
      headerImageUrl,
      forClient: true,
    });
    return this.pdfService.generatePdf({
      templateName: 'orden_trabajo_cliente',
      params,
    });
  }

  async sendReportsByEmail(
    dto: SendWorkOrderReportsDto,
    currentUser: any,
  ): Promise<{ sentTo: string; attachmentsCount: number }> {
    const roleName = this.getRoleName(currentUser);

    if (dto.reportType === WorkOrderReportType.INTERNAL) {
      if (!['Administrador', 'Secretaria', 'Supervisor'].includes(roleName)) {
        throw new ForbiddenException(
          'No tiene permisos para enviar informes internos.',
        );
      }
    }

    if (dto.reportType === WorkOrderReportType.CLIENT) {
      if (
        !['Administrador', 'Secretaria', 'Supervisor', 'Cliente'].includes(
          roleName,
        )
      ) {
        throw new ForbiddenException(
          'No tiene permisos para enviar informes cliente.',
        );
      }
    }

    if (!dto.orderIds || dto.orderIds.length === 0) {
      throw new BadRequestException('Debe enviar al menos una orden.');
    }

    const attachments: { filename: string; content: Buffer }[] = [];

    for (const id of dto.orderIds) {
      const workOrder = await this.findOne(id);

      if (workOrder.estado !== WorkOrderStatus.COMPLETED) {
        throw new BadRequestException(
          `La orden ${id} no está finalizada. Solo se pueden enviar informes de órdenes completadas.`,
        );
      }

      if (roleName === 'Técnico') {
        const isAssigned = workOrder.technicians?.some(
          (t) => t.tecnicoId === currentUser.userId,
        );
        if (!isAssigned) {
          throw new ForbiddenException(
            `No tiene acceso a la orden ${id} (no está asignado).`,
          );
        }
      }

      if (roleName === 'Cliente') {
        const hasAccess = await this.userHasAccessToEmpresa(
          currentUser.userId,
          workOrder.clienteEmpresaId,
        );
        if (!hasAccess) {
          throw new ForbiddenException(
            `No tiene acceso a la orden ${id} (no pertenece a sus empresas).`,
          );
        }
      }

      const buffer =
        dto.reportType === WorkOrderReportType.INTERNAL
          ? await this.generarInformeOrden(id)
          : await this.generarInformeOrdenCliente(id);

      const filename =
        dto.reportType === WorkOrderReportType.INTERNAL
          ? `OT-${id}-interno.pdf`
          : `Informe-Orden-Servicio-${id}-cliente.pdf`;

      attachments.push({ filename, content: buffer });
    }

    const zipName =
      dto.reportType === WorkOrderReportType.INTERNAL
        ? 'informes-internos-ordenes.zip'
        : 'informes-cliente-ordenes.zip';

    const finalAttachments = await this.buildAttachmentsWithOptionalZip(
      attachments,
      zipName,
    );

    const recipientName = currentUser?.nombre || currentUser?.name || undefined;

    await this.mailService.sendWorkOrderReportsEmail({
      to: dto.toEmail,
      cc: dto.ccEmails,
      templateParams: {
        orderIds: dto.orderIds,
        reportType:
          dto.reportType === WorkOrderReportType.INTERNAL
            ? 'internal'
            : 'client',
        recipientName,
        customMessage: dto.message,
      },
      attachments: finalAttachments,
    });

    return { sentTo: dto.toEmail, attachmentsCount: finalAttachments.length };
  }

  async sendReportsToClientsByEmail(
    dto: SendWorkOrderReportsToClientsDto,
    currentUser: any,
  ): Promise<{
    totalClientsNotified: number;
    details: {
      clienteEmpresaId: number;
      clientName: string;
      to: string;
      cc: string[];
      orderIds: number[];
    }[];
    skipped: {
      clienteEmpresaId: number | null;
      clientName: string | null;
      reason: string;
      orderIds: number[];
    }[];
  }> {
    const roleName = this.getRoleName(currentUser);

    if (!['Administrador', 'Secretaria', 'Supervisor'].includes(roleName)) {
      throw new ForbiddenException(
        'No tiene permisos para enviar informes a clientes.',
      );
    }

    let sourceOrders: WorkOrder[] = [];

    if (dto.orderIds && dto.orderIds.length > 0) {
      for (const id of dto.orderIds) {
        sourceOrders.push(await this.findOne(id));
      }
    } else {
      sourceOrders = await this.workOrdersRepository.find({
        where: { estado: WorkOrderStatus.COMPLETED },
        relations: ['clienteEmpresa'],
      });
    }

    if (sourceOrders.length === 0) {
      throw new BadRequestException(
        'No se encontraron órdenes completadas para enviar.',
      );
    }

    const groups = new Map<
      number | null,
      { orders: WorkOrder[]; clienteEmpresaId: number | null }
    >();

    for (const workOrder of sourceOrders) {
      if (workOrder.estado !== WorkOrderStatus.COMPLETED) {
        throw new BadRequestException(
          `La orden ${workOrder.ordenId} no está finalizada.`,
        );
      }

      const clienteEmpresaId = workOrder.clienteEmpresaId ?? null;
      if (!groups.has(clienteEmpresaId)) {
        groups.set(clienteEmpresaId, { orders: [], clienteEmpresaId });
      }
      groups.get(clienteEmpresaId)!.orders.push(workOrder);
    }

    const details: {
      clienteEmpresaId: number;
      clientName: string;
      to: string;
      cc: string[];
      orderIds: number[];
    }[] = [];

    const skipped: {
      clienteEmpresaId: number | null;
      clientName: string | null;
      reason: string;
      orderIds: number[];
    }[] = [];

    for (const [clienteEmpresaId, group] of groups.entries()) {
      const orderIdsForClient = group.orders.map((o) => o.ordenId);

      if (!clienteEmpresaId) {
        skipped.push({
          clienteEmpresaId: null,
          clientName: null,
          reason:
            'Las órdenes no tienen cliente empresa asociada. No se enviaron informes.',
          orderIds: orderIdsForClient,
        });
        continue;
      }

      const clienteEmpresa = await this.clientsRepository.findOne({
        where: { idCliente: clienteEmpresaId },
        relations: ['usuariosContacto'],
      });

      if (!clienteEmpresa) {
        skipped.push({
          clienteEmpresaId,
          clientName: null,
          reason: 'Cliente empresa no encontrado.',
          orderIds: orderIdsForClient,
        });
        continue;
      }

      const emails = (clienteEmpresa.usuariosContacto || [])
        .map((u) => u.email)
        .filter((e): e is string => !!e && e.trim().length > 0);

      if (emails.length === 0) {
        skipped.push({
          clienteEmpresaId,
          clientName: clienteEmpresa.nombre || null,
          reason:
            'El cliente no tiene usuarios contacto con correo configurado.',
          orderIds: orderIdsForClient,
        });
        continue;
      }

      const attachments: { filename: string; content: Buffer }[] = [];
      for (const order of group.orders) {
        const buffer = await this.generarInformeOrdenCliente(order.ordenId);
        attachments.push({
          filename: `Informe-Orden-Servicio-${order.ordenId}-cliente.pdf`,
          content: buffer,
        });
      }

      const finalAttachments = await this.buildAttachmentsWithOptionalZip(
        attachments,
        `informes-ordenes-${clienteEmpresa.nombre}.zip`,
      );

      const to = emails[0];
      const cc = emails.slice(1);

      await this.mailService.sendWorkOrderReportsEmail({
        to,
        cc,
        templateParams: {
          orderIds: orderIdsForClient,
          reportType: 'client',
          recipientName: clienteEmpresa.nombre || undefined,
          customMessage: dto.message,
        },
        attachments: finalAttachments,
      });

      details.push({
        clienteEmpresaId,
        clientName: clienteEmpresa.nombre,
        to,
        cc,
        orderIds: orderIdsForClient,
      });
    }

    return { totalClientsNotified: details.length, details, skipped };
  }

  async generateBatchReportsFile(
    orderIds: number[],
    reportType: WorkOrderReportType,
    currentUser: any,
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
    if (!orderIds || orderIds.length === 0) {
      throw new BadRequestException('Debe enviar al menos una orden.');
    }

    const roleName = this.getRoleName(currentUser);
    const attachments: { filename: string; content: Buffer }[] = [];

    for (const id of orderIds) {
      const workOrder = await this.findOne(id);

      if (workOrder.estado !== WorkOrderStatus.COMPLETED) {
        throw new BadRequestException(
          `La orden ${id} no está finalizada. Solo se pueden generar informes de órdenes completadas.`,
        );
      }

      if (roleName === 'Técnico') {
        const isAssigned = workOrder.technicians?.some(
          (t) => t.tecnicoId === currentUser.userId,
        );
        if (!isAssigned) {
          throw new ForbiddenException(
            `No tiene acceso a la orden ${id} (no está asignado).`,
          );
        }
      }

      if (roleName === 'Cliente') {
        const hasAccess = await this.userHasAccessToEmpresa(
          currentUser.userId,
          workOrder.clienteEmpresaId,
        );
        if (!hasAccess) {
          throw new ForbiddenException(
            `No tiene acceso a la orden ${id} (no pertenece a sus empresas).`,
          );
        }
      }

      const buffer =
        reportType === WorkOrderReportType.INTERNAL
          ? await this.generarInformeOrden(id)
          : await this.generarInformeOrdenCliente(id);

      const filename =
        reportType === WorkOrderReportType.INTERNAL
          ? `OT-${id}-interno.pdf`
          : `Informe-Orden-Servicio-${id}-cliente.pdf`;

      attachments.push({ filename, content: buffer });
    }

    if (attachments.length === 1) {
      return {
        buffer: attachments[0].content,
        fileName: attachments[0].filename,
        contentType: 'application/pdf',
      };
    }

    const zip = new JSZip();
    for (const att of attachments) {
      zip.file(att.filename, att.content);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipName =
      reportType === WorkOrderReportType.INTERNAL
        ? 'informes-internos-ordenes.zip'
        : 'informes-cliente-ordenes.zip';

    return {
      buffer: zipBuffer,
      fileName: zipName,
      contentType: 'application/zip',
    };
  }

  private async buildAttachmentsWithOptionalZip(
    attachments: { filename: string; content: Buffer }[],
    zipName: string,
  ): Promise<{ filename: string; content: Buffer }[]> {
    const totalSize = attachments.reduce(
      (sum, att) => sum + att.content.length,
      0,
    );

    if (totalSize <= this.MAX_EMAIL_ATTACHMENT_BYTES) return attachments;

    const zip = new JSZip();
    for (const att of attachments) {
      zip.file(att.filename, att.content);
    }

    return [
      {
        filename: zipName,
        content: await zip.generateAsync({ type: 'nodebuffer' }),
      },
    ];
  }

  private async releaseToolsForOrder(ordenId: number): Promise<void> {
    const toolDetails = await this.toolDetailsRepository.find({
      where: { ordenId },
    });

    if (!toolDetails.length) return;

    const toolIds = toolDetails.map((d) => d.herramientaId);
    await this.toolRepository.update(
      { herramientaId: In(toolIds) },
      { estado: ToolStatus.DISPONIBLE },
    );
  }

  async crearOrdenesAutomaticasSemanalesViernes(): Promise<{
    created: number;
    skipped: number;
  }> {
    const hoyCol = this.startOfDay(this.getColombiaTime());
    const { weekStart, weekEnd } = this.getNextWeekRangeFromFriday(hoyCol);

    const planes = await this.planRepo
      .createQueryBuilder('plan')
      .innerJoinAndSelect('plan.equipment', 'equipment')
      .where('plan.fechaProgramada BETWEEN :weekStart AND :weekEnd', {
        weekStart: this.dateOnlyStr(weekStart),
        weekEnd: this.dateOnlyStr(weekEnd),
      })
      .andWhere('equipment.status = :status', {
        status: EquipmentStatus.ACTIVE,
      })
      .andWhere('equipment.planMantenimientoAutomatico = true')
      .getMany();

    if (!planes.length) return { created: 0, skipped: 0 };

    const groups = new Map<string, PlanMantenimiento[]>();

    for (const plan of planes) {
      const eq = plan.equipment;
      if (!eq?.clientId || !eq?.category) continue;

      const key = `${eq.clientId}::${eq.category}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(plan);
    }

    let created = 0;
    let skipped = 0;

    for (const [key, groupPlans] of groups.entries()) {
      const [clienteEmpresaIdStr, categoryStr] = key.split('::');
      const clienteEmpresaId = Number(clienteEmpresaIdStr);
      const category = categoryStr as ServiceCategory;

      const servicio = await this.servicesRepository.findOne({
        where: { categoriaServicio: category },
        order: { servicioId: 'ASC' },
      });

      if (!servicio) {
        skipped++;
        continue;
      }

      const batchKey = this.buildAutoBatchKey({
        clienteEmpresaId,
        servicioId: servicio.servicioId,
        weekStart,
      });

      const existing = await this.workOrdersRepository.findOne({
        where: { autoBatchKey: batchKey },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const candidateEquipmentIds = Array.from(
        new Set(
          groupPlans
            .map((p) => p.equipment?.equipmentId)
            .filter((id): id is number => typeof id === 'number'),
        ),
      );

      const busy = await this.getBusyEquipmentIds(candidateEquipmentIds);
      const finalEquipmentIds = candidateEquipmentIds.filter(
        (id) => !busy.has(id),
      );

      if (!finalEquipmentIds.length) {
        skipped++;
        continue;
      }

      let usuarioContacto: User;
      try {
        usuarioContacto =
          await this.resolveUsuarioContactoParaEmpresa(clienteEmpresaId);
      } catch {
        skipped++;
        continue;
      }

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const wo = this.workOrdersRepository.create({
          servicioId: servicio.servicioId,
          clienteEmpresaId,
          clienteId: usuarioContacto.usuarioId,
          fechaProgramada: weekStart,
          comentarios: `Mantenimiento automático semanal (${this.dateOnlyStr(
            weekStart,
          )} a ${this.dateOnlyStr(weekEnd)})`,
          estado: WorkOrderStatus.REQUESTED_UNASSIGNED,
          estadoFacturacion: null,
          estadoPago: null,
          isEmergency: false,
          isAutomaticWeekly: true,
          autoBatchKey: batchKey,
          autoWeekStart: weekStart,
          autoWeekEnd: weekEnd,
          planMantenimientoId: null,
        });

        const savedWO = await queryRunner.manager.save(WorkOrder, wo);

        const ewoRows = finalEquipmentIds.map((equipmentId) =>
          this.equipmentWorkOrderRepository.create({
            workOrderId: savedWO.ordenId,
            equipmentId,
            description: 'Mantenimiento automático semanal (desde planes)',
          }),
        );
        await queryRunner.manager.save(EquipmentWorkOrder, ewoRows);

        const allowed = new Set(finalEquipmentIds);
        const includedPlans = groupPlans.filter((p) => {
          const id = p.equipment?.equipmentId;
          return typeof id === 'number' && allowed.has(id);
        });

        const linkRows = includedPlans.map((p) =>
          this.woPlanRepo.create({
            ordenId: savedWO.ordenId,
            planId: p.id,
          }),
        );
        await queryRunner.manager.save(WorkOrderMaintenancePlan, linkRows);

        await queryRunner.commitTransaction();

        const full = await this.findOne(savedWO.ordenId);
        this.realtime.emitEntityUpdate(
          'workOrders',
          'created',
          full,
          undefined,
        );
        this.eventEmitter.emit('work-order.created', {
          workOrderId: full.ordenId,
          clienteId: full.clienteId,
          servicioId: full.servicioId,
          equipmentIds: finalEquipmentIds,
          isEmergency: false,
        });

        created++;
      } catch (e: any) {
        await queryRunner.rollbackTransaction();
        if (e?.code === '23505') {
          skipped++;
          continue;
        }
        throw e;
      } finally {
        await queryRunner.release();
      }
    }

    return { created, skipped };
  }
}
