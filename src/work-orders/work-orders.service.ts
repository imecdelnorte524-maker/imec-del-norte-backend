// src/work-orders/work-orders.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource, In, Not, IsNull } from 'typeorm';
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
import { ToolStatus, SupplyStatus } from '../shared/index';
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
import { Image } from 'src/images/entities/image.entity';
import { CostStatus } from '../shared/index';
import { PdfService } from 'src/pdf/pdf.service';
import { ConfigService } from '@nestjs/config';
import { buildInformeOrdenParams } from '../../templates/report/informe-orden-html.helper';
import {
  SendWorkOrderReportsDto,
  WorkOrderReportType,
} from './dto/send-work-order-reports.dto';
import { MailService } from 'src/mail/mail.service';
import { SendWorkOrderReportsToClientsDto } from './dto/send-work-order-reports-to-clients.dto';
import JSZip from 'jszip';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';

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
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly pdfService: PdfService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  private readonly MAX_EMAIL_ATTACHMENT_BYTES = 30 * 1024 * 1024;
  private getRoleName(currentUser: any): string {
    return currentUser?.role?.nombreRol || currentUser?.role || '';
  }

  private getColombiaTime(): Date {
    const now = new Date();
    // Colombia es UTC-5
    const colombiaOffset = -5 * 60; // en minutos
    const localOffset = now.getTimezoneOffset(); // en minutos
    const offsetDiff = colombiaOffset - localOffset;
    return new Date(now.getTime() + offsetDiff * 60000);
  }

  // Helper para verificar si un usuario es contacto de un cliente
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

  // Helper para obtener el primer usuario contacto de un cliente
  private getPrimerUsuarioContacto(cliente: Client): User | null {
    return cliente.usuariosContacto?.[0] || null;
  }

  async create(dto: CreateWorkOrderDto, currentUser: any): Promise<WorkOrder> {
    const roleName = this.getRoleName(currentUser);

    if (roleName === 'Cliente') {
      dto.clienteId = currentUser.userId;

      // Buscar empresas donde el usuario es contacto
      const empresasCliente = await this.clientsRepository
        .createQueryBuilder('cliente')
        .innerJoinAndSelect('cliente.usuariosContacto', 'usuario')
        .where('usuario.usuarioId = :userId', { userId: currentUser.userId })
        .getMany();

      if (empresasCliente.length > 0) {
        // Tomar la primera empresa (o puedes implementar lógica para elegir)
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

        // Buscar empresas donde el usuario es contacto
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

    // CORRECCIÓN: Aseguramos que equipmentIds sea array
    const equipmentIds = dto.equipmentIds || [];

    // Validar equipos si se envían
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
    // CORRECCIÓN: estadoFacturacion siempre null al crear
    dto.estadoFacturacion = null;

    const workOrder = this.workOrdersRepository.create(dto);
    const savedWorkOrder = await this.workOrdersRepository.save(workOrder);

    // Asociar equipos si se especificaron
    if (equipmentIds.length > 0) {
      const equipmentWorkOrders = equipmentIds.map((equipmentId) =>
        this.equipmentWorkOrderRepository.create({
          workOrderId: savedWorkOrder.ordenId,
          equipmentId,
        }),
      );
      await this.equipmentWorkOrderRepository.save(equipmentWorkOrders);
    }

    // Asociar técnicos si se especificaron
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
      equipmentIds: equipmentIds,
      isEmergency: savedWorkOrder.isEmergency || false,
    });

    const full = await this.findOne(savedWorkOrder.ordenId);

    // 🔴 WebSocket
    this.notificationsGateway.server.emit('workOrders.created', full);

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

    // Verificar que los equipos pertenezcan al cliente
    for (const equipment of equipments) {
      if (equipment.clientId !== clienteEmpresaId) {
        throw new BadRequestException(
          `El equipo ${equipment.code || equipment.equipmentId} no pertenece al cliente de la orden`,
        );
      }
    }

    // NUEVO: Verificar que los equipos no estén ya asignados a otra orden en proceso
    const activeOrders = await this.workOrdersRepository
      .createQueryBuilder('wo')
      .innerJoin('wo.equipmentWorkOrders', 'ewo')
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
        `
        CASE
          WHEN workOrder.estado = :unassigned THEN 1
          WHEN workOrder.estado = :assigned THEN 2
          WHEN workOrder.estado = :inProgress THEN 3
          WHEN workOrder.estado = :paused THEN 4
          WHEN workOrder.estado = :completed THEN 5
          WHEN workOrder.estado = :canceled THEN 6
          ELSE 7
        END
      `,
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
          'Debe registrar la inspección inicial de al menos un equipo para iniciar',
        );
      }

      const hasPhoto = await this.hasAcEvidence(
        id,
        WorkOrderEvidencePhase.BEFORE,
      );
      if (!hasPhoto) {
        throw new BadRequestException(
          'Debe subir al menos una evidencia fotográfica inicial',
        );
      }
    }

    if (isAC && updateWorkOrderDto.estado === WorkOrderStatus.COMPLETED) {
      const allDone = await this.areAllAcInspectionsDone(
        id,
        AcInspectionPhase.AFTER,
      );
      if (!allDone) {
        throw new BadRequestException(
          'Faltan equipos por registrar con parámetros finales para completar la orden',
        );
      }

      const hasFinalPhoto = await this.hasAcEvidence(
        id,
        WorkOrderEvidencePhase.AFTER,
      );
      if (!hasFinalPhoto) {
        throw new BadRequestException(
          'Debe subir evidencias fotográficas finales antes de completar',
        );
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
      updateWorkOrderDto.fechaInicio = this.getColombiaTime();
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
      updateWorkOrderDto.fechaFinalizacion = this.getColombiaTime();
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

    // --- 7. EVENTOS DE NOTIFICACIÓN ---

    // Evento genérico de actualización
    this.eventEmitter.emit('work-order.updated', {
      ordenId: id,
      action: 'update',
      previousStatus,
    });

    // 🔥 EVENTO: Orden finalizada
    if (
      updateWorkOrderDto.estado === WorkOrderStatus.COMPLETED &&
      previousStatus !== WorkOrderStatus.COMPLETED
    ) {
      this.eventEmitter.emit('work-order.completed', {
        workOrderId: id,
        fechaFinalizacion: updatedWorkOrder.fechaFinalizacion || new Date(),
        completedBy: currentUser?.userId,
        clienteId: updatedWorkOrder.clienteId, // IMPORTANTE: para notificar al cliente
        clienteEmpresaId: updatedWorkOrder.clienteEmpresaId,
      });
    }

    // 🔥 EVENTO: Orden cancelada
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

    // 🔥 EVENTO: Cambio de estado general (útil para tracking)
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

    // --- 8. WEB SOCKET ---
    await this.emitWorkOrderUpdated(id, {
      previousStatus,
      clientId,
    });

    return updatedWorkOrder;
  }

  private async updateEquipmentAssociations(
    ordenId: number,
    equipmentIds: number[],
    clienteEmpresaId: number,
  ): Promise<void> {
    await this.equipmentWorkOrderRepository.delete({
      workOrderId: ordenId,
    });

    if (equipmentIds.length > 0) {
      await this.validateEquipmentAssignment(equipmentIds, clienteEmpresaId);
      const equipmentWorkOrders = equipmentIds.map((equipmentId) => ({
        workOrderId: ordenId,
        equipmentId,
      }));
      await this.equipmentWorkOrderRepository.save(equipmentWorkOrders);
    }
  }

  private async updateTechnicianAssociations(
    ordenId: number,
    technicianIds: number[],
    leaderTechnicianId?: number,
  ): Promise<void> {
    await this.workOrderTechnicianRepository.delete({
      ordenId,
    });

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
    const now = new Date();
    if (now > deadline) {
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

    // 🔴 WebSocket
    await this.emitWorkOrderUpdated(id, {
      previousStatus,
      clientId: currentUser.clientId,
    });

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
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
        // CORRECCIÓN: usar inventories[0]
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
      await queryRunner.manager.remove(workOrder);

      await queryRunner.commitTransaction();
      this.eventEmitter.emit('work-order.deleted', {
        ordenId: id,
      });

      // 🔴 WebSocket
      this.notificationsGateway.server.emit('workOrders.deleted', { id });
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

    const workOrder = await this.findOne(ordenId);

    // Usar el nuevo método assignTechnicians para compatibilidad
    const dto: AssignTechniciansDto = {
      technicianIds: [tecnicoId],
      leaderTechnicianId: tecnicoId,
    };

    const updated = await this.assignTechnicians(ordenId, dto);

    this.eventEmitter.emit('work-order.updated', {
      ordenId,
      action: 'assignTechnician',
    });

    return updated;
  }

  async assignTechnicians(
    ordenId: number,
    dto: AssignTechniciansDto,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);

    // Validar que todos los técnicos existan y sean técnicos
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

    // Validar que el líder esté en la lista de técnicos
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

    // Actualizar estado si estaba sin asignar
    const nuevoEstado =
      workOrder.estado === WorkOrderStatus.REQUESTED_UNASSIGNED
        ? WorkOrderStatus.REQUESTED_ASSIGNED
        : workOrder.estado;

    await this.workOrdersRepository.update(ordenId, {
      estado: nuevoEstado,
    });

    const updated = await this.findOne(ordenId);
    this.eventEmitter.emit('work-order.assigned', {
      workOrderId: updated.ordenId,
      technicianIds: dto.technicianIds,
      leaderTechnicianId: dto.leaderTechnicianId,
      clienteId: updated.clienteId,
      servicioId: updated.servicioId,
    });

    this.eventEmitter.emit('work-order.updated', {
      ordenId,
      action: 'assignTechnicians',
    });

    // 🔴 WebSocket
    await this.emitWorkOrderUpdated(ordenId, {
      previousStatus: workOrder.estado,
      emitAssigned: true,
    });

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

  async unassignTechnician(ordenId: number): Promise<WorkOrder> {
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

    const nuevoEstado =
      workOrder.estado === WorkOrderStatus.REQUESTED_ASSIGNED
        ? WorkOrderStatus.REQUESTED_UNASSIGNED
        : workOrder.estado;

    // Eliminar todos los técnicos
    await this.workOrderTechnicianRepository.delete({ ordenId });

    await this.workOrdersRepository.update(ordenId, {
      estado: nuevoEstado,
    });
    const updated = await this.findOne(ordenId);

    this.eventEmitter.emit('work-order.updated', {
      ordenId,
      action: 'unassignTechnician',
    });

    // 🔴 WebSocket
    await this.emitWorkOrderUpdated(ordenId, {
      previousStatus: workOrder.estado,
      emitAssigned: true,
    });

    return updated;
  }

  async unassignAllTechnicians(ordenId: number): Promise<WorkOrder> {
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

    await this.workOrderTechnicianRepository.delete({ ordenId });

    const nuevoEstado =
      workOrder.estado === WorkOrderStatus.REQUESTED_ASSIGNED
        ? WorkOrderStatus.REQUESTED_UNASSIGNED
        : workOrder.estado;

    await this.workOrdersRepository.update(ordenId, {
      estado: nuevoEstado,
    });

    this.eventEmitter.emit('work-order.updated', {
      ordenId,
      action: 'unassignAllTechnicians',
    });

    const updated = await this.findOne(ordenId);
    // 🔴 WebSocket
    await this.emitWorkOrderUpdated(ordenId, {
      previousStatus: workOrder.estado,
      emitAssigned: true,
    });

    return updated;
  }

  async addEquipmentToOrder(
    ordenId: number,
    equipmentId: number,
    description?: string,
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

    // Verificar que el equipo no esté ya asignado a otra orden activa
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

    // 🔴 WebSocket
    await this.emitWorkOrderUpdated(ordenId);

    return saved;
  }

  async removeEquipmentFromOrder(
    ordenId: number,
    equipmentId: number,
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

    // 🔴 WebSocket
    await this.emitWorkOrderUpdated(ordenId);
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

  // --- CORRECCIONES EN TIMER Y PAUSA ---

  async startTimer(ordenId: number, userId: number): Promise<WorkOrderTimer> {
    const workOrder = await this.findOne(ordenId);

    // 🔴 CORRECCIÓN: Permitir si está pausada o asignada/en proceso. Solo bloquear completada/cancelada.
    if (
      workOrder.estado === WorkOrderStatus.COMPLETED ||
      workOrder.estado === WorkOrderStatus.CANCELED
    ) {
      throw new BadRequestException(
        'No se puede iniciar el timer en una orden finalizada o cancelada',
      );
    }

    // Verificar si ya hay un timer activo
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

    // 🔴 CORRECCIÓN: Detener timer solo si existe (tolerante a fallos previos)
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

    // Encontrar la pausa activa más reciente
    const activePause = await this.workOrderPauseRepository.findOne({
      where: { ordenId, endTime: IsNull() },
      order: { startTime: 'DESC' },
    });

    if (activePause) {
      activePause.endTime = this.getColombiaTime();
      await this.workOrderPauseRepository.save(activePause);
    }

    // Iniciar nuevo timer
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
            const newLeaderId = remainingTechs[0].tecnicoId;
            await this.workOrderTechnicianRepository.update(
              { ordenId, tecnicoId: newLeaderId },
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
          const newLeaderId = remainingTechs[0].tecnicoId;
          await this.workOrderTechnicianRepository.update(
            { ordenId, tecnicoId: newLeaderId },
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

    // Aseguramos que el líder esté dentro de technicianIds
    const leaderTechnicianId =
      dto.leaderTechnicianId &&
      emergencyTechIds.includes(dto.leaderTechnicianId)
        ? dto.leaderTechnicianId
        : emergencyTechIds[0];

    // Comentario para la orden de emergencia
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
    });

    await this.emitWorkOrderUpdated(ordenId, {
      previousStatus: originalOrder.estado,
      emitAssigned: true,
    });

    this.notificationsGateway.server.emit('workOrders.emergencyCreated', {
      originalOrderId: ordenId,
      emergencyOrder,
    });

    return emergencyOrder;
  }

  async addSupplyDetail(
    ordenId: number,
    addSupplyDetailDto: AddSupplyDetailDto,
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
      // Verificar que la orden existe
      await this.findOne(ordenId);

      // Buscar el insumo con su inventario - CORRECCIÓN: usar 'inventories' en lugar de 'inventory'
      const supply = await queryRunner.manager.findOne(Supply, {
        where: { insumoId: addSupplyDetailDto.insumoId },
        relations: ['inventories', 'unidadMedida'], // 👈 CAMBIADO: 'inventories' en lugar de 'inventory'
      });

      if (!supply) {
        throw new NotFoundException(
          `Insumo con ID ${addSupplyDetailDto.insumoId} no encontrado`,
        );
      }

      // CORRECCIÓN: Acceder al primer inventario (o al que corresponda)
      const inventory = supply.inventories?.[0]; // 👈 CAMBIADO: inventories[0] en lugar de inventory

      if (!inventory) {
        throw new NotFoundException(
          `Inventario para insumo ID ${addSupplyDetailDto.insumoId} no encontrado`,
        );
      }

      const cantidadActual = Number(inventory.cantidadActual); // 👈 CAMBIADO
      const cantidadSolicitada = Number(addSupplyDetailDto.cantidadUsada);

      if (cantidadActual < cantidadSolicitada) {
        throw new ConflictException(
          `Stock insuficiente para ${supply.nombre}. Disponible: ${cantidadActual} ${supply.unidadMedida?.nombre || ''}, Solicitado: ${cantidadSolicitada}`,
        );
      }

      // Verificar si ya existe un detalle similar
      const existingDetail = await queryRunner.manager.findOne(SupplyDetail, {
        where: {
          ordenId,
          insumoId: addSupplyDetailDto.insumoId,
        },
      });

      if (existingDetail) {
        // Opcional: actualizar cantidad en lugar de crear nuevo
        // o simplemente continuar según tu lógica de negocio
      }

      // Crear el detalle de insumo
      const supplyDetail = queryRunner.manager.create(SupplyDetail, {
        ordenId,
        insumoId: addSupplyDetailDto.insumoId,
        cantidadUsada: cantidadSolicitada,
        costoUnitarioAlMomento:
          addSupplyDetailDto.costoUnitarioAlMomento || supply.valorUnitario,
      });

      const savedDetail = await queryRunner.manager.save(supplyDetail);

      // Actualizar inventario - CORRECCIÓN: usar inventory en lugar de supply.inventory
      const nuevoStock = cantidadActual - cantidadSolicitada;
      inventory.cantidadActual = nuevoStock; // 👈 CAMBIADO
      inventory.fechaUltimaActualizacion = new Date(); // 👈 CAMBIADO
      await queryRunner.manager.save(inventory); // 👈 CAMBIADO

      // Actualizar estado del insumo según nuevo stock
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

        // Emitir evento si el stock está bajo o agotado
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

      // WebSocket
      await this.emitWorkOrderUpdated(ordenId);

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

      // 🔴 WebSocket
      await this.emitWorkOrderUpdated(ordenId);

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
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const supplyDetail = await queryRunner.manager.findOne(SupplyDetail, {
        where: { detalleInsumoId, ordenId },
        relations: ['supply', 'supply.inventories'], // 👈 CAMBIADO: inventories
      });

      if (!supplyDetail) {
        throw new NotFoundException(
          'Detalle de insumo no encontrado en esta orden',
        );
      }

      // CORRECCIÓN: usar inventories[0]
      const inventory = supplyDetail.supply?.inventories?.[0]; // 👈 CAMBIADO

      if (inventory) {
        const cantidadUsada = Number(supplyDetail.cantidadUsada);
        inventory.cantidadActual =
          Number(inventory.cantidadActual) + cantidadUsada;
        inventory.fechaUltimaActualizacion = new Date();

        await queryRunner.manager.save(inventory);

        const nuevoStock = inventory.cantidadActual;
        const estado = this.calculateSupplyStatus(
          nuevoStock,
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

      await this.emitWorkOrderUpdated(ordenId);
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

      // 🔴 WebSocket
      await this.emitWorkOrderUpdated(ordenId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getWorkOrdersByStatus(estado: string): Promise<WorkOrder[]> {
    return await this.workOrdersRepository
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
    return await this.workOrdersRepository
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
        `
        CASE
          WHEN workOrder.estado = :unassigned THEN 1
          WHEN workOrder.estado = :assigned THEN 2
          WHEN workOrder.estado = :inProgress THEN 3
          WHEN workOrder.estado = :paused THEN 4
          WHEN workOrder.estado = :completed THEN 5
          WHEN workOrder.estado = :canceled THEN 6
          ELSE 7
        END
      `,
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
    return await this.workOrdersRepository
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
        `
        CASE
          WHEN workOrder.estado = :unassigned THEN 1
          WHEN workOrder.estado = :assigned THEN 2
          WHEN workOrder.estado = :inProgress THEN 3
          WHEN workOrder.estado = :paused THEN 4
          WHEN workOrder.estado = :completed THEN 5
          WHEN workOrder.estado = :canceled THEN 6
          ELSE 7
        END
      `,
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
    return await this.workOrdersRepository.find({
      where: {
        fechaSolicitud: Between(startDate, endDate),
      },
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
    const workOrders = await this.workOrdersRepository
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
      .andWhere('workOrder.estado IN (:...estadosValidos)', {
        estadosValidos: [
          WorkOrderStatus.REQUESTED_UNASSIGNED,
          WorkOrderStatus.REQUESTED_ASSIGNED,
        ],
      })
      .andWhere('service.categoriaServicio = :category', {
        category: category as ServiceCategory,
      })
      .orderBy('workOrder.fechaSolicitud', 'DESC')
      .getMany();

    return workOrders;
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

    // Solo Admin/Secretaria pueden cambiar de PAUSED a COMPLETED o CANCELED
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

    let costoTotalInsumos = 0;
    if (workOrder.supplyDetails) {
      costoTotalInsumos = workOrder.supplyDetails.reduce((total, detail) => {
        return (
          total +
          Number(detail.cantidadUsada) *
            Number(detail.costoUnitarioAlMomento || 0)
        );
      }, 0);
    }

    // Calcular tiempo total
    let tiempoTotal = 0;
    if (workOrder.timers) {
      tiempoTotal = workOrder.timers.reduce((total, timer) => {
        if (timer.endTime) {
          return total + timer.totalSeconds;
        } else {
          const now = this.getColombiaTime();
          const startTime = new Date(timer.startTime);
          return (
            total + Math.floor((now.getTime() - startTime.getTime()) / 1000)
          );
        }
      }, 0);
    }

    return {
      costoTotalInsumos,
      tiempoTotal,
    };
  }

  private calculateSupplyStatus(
    cantidad: number,
    stockMin: number = 0,
  ): SupplyStatus {
    if (cantidad === 0) {
      return SupplyStatus.AGOTADO;
    } else if (stockMin > 0 && cantidad <= stockMin) {
      return SupplyStatus.STOCK_BAJO;
    } else {
      return SupplyStatus.DISPONIBLE;
    }
  }

  private addBusinessDays(date: Date, businessDays: number): Date {
    const result = new Date(date);
    let added = 0;
    while (added < businessDays) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      if (day !== 0 && day !== 6) {
        added++;
      }
    }
    return result;
  }

  async removeInvoice(ordenId: number): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);

    workOrder.facturaPdfUrl = undefined;
    workOrder.estadoFacturacion = BillingStatus.NULL;
    workOrder.estadoPago = CostStatus.NULL;

    await this.workOrdersRepository.save(workOrder);

    const updated = await this.findOne(ordenId);

    // 🔴 WebSocket
    this.notificationsGateway.server.emit('workOrders.updated', updated);
    this.notificationsGateway.server.emit('workOrders.invoiceRemoved', updated);

    return updated;
  }

  async uploadInvoice(
    ordenId: number,
    invoiceUrl: string,
    estadoPago?: string,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);

    if (workOrder.estado !== WorkOrderStatus.COMPLETED) {
      throw new BadRequestException(
        'Solo se puede facturar una orden que esté Finalizada',
      );
    }

    // Validar que todos los técnicos estén calificados
    if (workOrder.technicians && workOrder.technicians.length > 0) {
      const hasUnrated = workOrder.technicians.some(
        (t) => t.rating === null || t.rating === undefined,
      );
      if (hasUnrated) {
        throw new BadRequestException(
          'Debe calificar a todos los técnicos antes de subir la factura de la orden',
        );
      }
    }

    // Validar que no tenga ya una factura
    if (workOrder.facturaPdfUrl) {
      throw new BadRequestException('La orden ya tiene una factura asociada');
    }

    // Actualizar la orden con la URL de Cloudinary
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
    });

    // 🔴 WebSocket
    this.notificationsGateway.server.emit('workOrders.updated', updated);
    this.notificationsGateway.server.emit('workOrders.invoiceUpdated', updated);

    return updated;
  }

  async existeOrdenParaPlanEnFecha(
    planMantenimientoId: number,
    fechaProgramada: Date,
  ): Promise<boolean> {
    if (!planMantenimientoId || !fechaProgramada) {
      return false;
    }

    const fechaStr = fechaProgramada.toISOString().slice(0, 10);

    const count = await this.workOrdersRepository
      .createQueryBuilder('wo')
      .where('wo.planMantenimientoId = :planMantenimientoId', {
        planMantenimientoId,
      })
      .andWhere('wo.fechaProgramada = :fechaProgramada', {
        fechaProgramada: fechaStr,
      })
      .getCount();

    return count > 0;
  }

  async createFromMaintenancePlan(params: {
    plan: PlanMantenimiento;
    fechaProgramada: Date;
  }): Promise<WorkOrder> {
    const { plan, fechaProgramada } = params;

    if (!plan?.equipmentId) {
      throw new BadRequestException(
        `El plan de mantenimiento ${plan?.id} no tiene equipmentId`,
      );
    }

    const equipment = await this.equipmentRepository.findOne({
      where: { equipmentId: plan.equipmentId },
      relations: ['client'],
    });

    if (!equipment) {
      throw new NotFoundException(
        `Equipo ${plan.equipmentId} asociado al plan ${plan.id} no encontrado`,
      );
    }

    // Obtener el cliente empresa COMPLETO (con el campo contacto)
    const clienteEmpresa = await this.clientsRepository.findOne({
      where: { idCliente: equipment.clientId },
    });

    if (!clienteEmpresa) {
      throw new NotFoundException(
        `Cliente empresa ${equipment.clientId} del equipo ${equipment.equipmentId} no encontrado`,
      );
    }

    // Consultar los contactos REALES desde la tabla intermedia
    const clientesConContactos = await this.clientsRepository
      .createQueryBuilder('cliente')
      .innerJoinAndSelect('cliente.usuariosContacto', 'usuario')
      .where('cliente.idCliente = :clienteId', {
        clienteId: equipment.clientId,
      })
      .getOne();

    if (
      !clientesConContactos ||
      !clientesConContactos.usuariosContacto?.length
    ) {
      throw new BadRequestException(
        `El cliente empresa ${clienteEmpresa.nombre} no tiene usuarios contacto asignados en la tabla intermedia`,
      );
    }


    // 🔴 BUSCAR POR NOMBRE (campo contacto) - CORREGIDO
    let usuarioSeleccionado: User | null = null; // 👈 Tipo explícito User | null
    const nombreContacto = clienteEmpresa.contacto?.toLowerCase().trim() || '';

    if (nombreContacto) {
      const encontrado = clientesConContactos.usuariosContacto.find(
        (usuario) => {
          const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`
            .toLowerCase()
            .trim();
          // Coincidencia exacta o parcial (ignorando títulos)
          return (
            nombreCompleto.includes(nombreContacto) ||
            nombreContacto.includes(nombreCompleto)
          );
        },
      );

      usuarioSeleccionado = encontrado || null; // 👈 Convertir undefined a null
    }

    // Si no encontramos por nombre, USAR EL PRIMERO
    if (!usuarioSeleccionado) {
      usuarioSeleccionado = clientesConContactos.usuariosContacto[0];
    } 

    const servicio = await this.servicesRepository.findOne({
      where: { categoriaServicio: equipment.category as ServiceCategory },
      order: { servicioId: 'ASC' },
    });

    if (!servicio) {
      throw new NotFoundException(
        `No se encontró un servicio para la categoría ${equipment.category}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const workOrder = this.workOrdersRepository.create({
        servicioId: servicio.servicioId,
        clienteId: usuarioSeleccionado.usuarioId, // ✅ Ya no hay error de tipos
        clienteEmpresaId: clienteEmpresa.idCliente,
        fechaProgramada,
        comentarios:
          plan.notas ??
          `Mantenimiento programado para el equipo ${
            equipment.code || equipment.equipmentId
          } - ${equipment.area?.nombreArea} - ${equipment.subArea?.nombreSubArea}`,
        estado: WorkOrderStatus.REQUESTED_UNASSIGNED,
        estadoFacturacion: null,
        maintenanceTypeId: undefined,
        planMantenimientoId: plan.id,
        isEmergency: false,
      });

      const savedWorkOrder = await queryRunner.manager.save(workOrder);

      const ewo = this.equipmentWorkOrderRepository.create({
        workOrderId: savedWorkOrder.ordenId,
        equipmentId: equipment.equipmentId,
        description:
          'Mantenimiento automático programado desde plan de mantenimiento',
      });

      await queryRunner.manager.save(EquipmentWorkOrder, ewo);

      await queryRunner.commitTransaction();

      this.eventEmitter.emit('work-order.created', {
        workOrderId: savedWorkOrder.ordenId,
        clienteId: savedWorkOrder.clienteId,
        servicioId: savedWorkOrder.servicioId,
        equipmentIds: [equipment.equipmentId],
        isEmergency: false,
      });

      const full = await this.findOne(savedWorkOrder.ordenId);

      this.notificationsGateway.server.emit('workOrders.created', full);

      return full;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async emitWorkOrderUpdated(
    ordenId: number,
    options?: {
      previousStatus?: WorkOrderStatus;
      emitAssigned?: boolean;
      extraEvent?: string;
      extraPayload?: any;
      clientId?: string;
    },
  ): Promise<void> {
    const workOrder = await this.findOne(ordenId);

    // Emitir SIEMPRE actualización general
    this.notificationsGateway.server.emit('workOrders.updated', workOrder);

    // Cambio de estado
    if (
      options?.previousStatus &&
      options.previousStatus !== workOrder.estado
    ) {
      this.notificationsGateway.server.emit(
        'workOrders.statusUpdated',
        workOrder,
      );
    }

    // Cambio de técnicos asignados
    if (options?.emitAssigned) {
      const assignedData = {
        workOrder,
        technicianIds: workOrder.technicians?.map((t) => t.tecnicoId) ?? [],
      };
      this.notificationsGateway.server.emit(
        'workOrders.assigned',
        assignedData,
      );
    }

    // Evento extra opcional
    if (options?.extraEvent) {
      const extraData = options.extraPayload ?? workOrder;
      this.notificationsGateway.server.emit(options.extraEvent, extraData);
    }
  }

  async rateTechnicians(
    ordenId: number,
    dto: RateTechniciansDto,
    currentUser: any,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);
    const roleName = this.getRoleName(currentUser);

    // Solo Admin o Supervisor pueden calificar
    if (!['Administrador', 'Supervisor'].includes(roleName)) {
      throw new ForbiddenException(
        'Solo Administrador o Supervisor pueden calificar técnicos',
      );
    }

    // Solo órdenes completadas se pueden calificar
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

    // Debe venir una calificación por cada técnico asignado, sin duplicados
    if (
      uniqueBodyIds.size !== bodyIds.length ||
      assignedIds.length !== uniqueBodyIds.size ||
      assignedIds.some((id) => !uniqueBodyIds.has(id))
    ) {
      throw new BadRequestException(
        'Debe enviar una calificación para cada técnico asignado, sin duplicados',
      );
    }

    // Validar y aplicar calificaciones
    for (const ratingDto of dto.ratings) {
      const { technicianId, rating } = ratingDto;

      // Validar incremento de 0.5
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

      // Solo una calificación por técnico y orden
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

    // 🔴 WebSocket
    await this.emitWorkOrderUpdated(ordenId, {
      extraEvent: 'workOrders.techniciansRated',
      extraPayload: { ordenId },
      clientId: currentUser.clientId,
    });

    return this.findOne(ordenId);
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

    // No permitir firma si ya está completada o cancelada
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

    // WebSocket
    await this.emitWorkOrderUpdated(ordenId, {
      extraEvent: 'workOrders.receiptSigned',
      extraPayload: { ordenId },
      clientId: currentUser.clientId,
    });

    return this.findOne(ordenId);
  }

  async getEmpresaIdsForClientUser(userId: number): Promise<number[]> {
    const empresas = await this.clientsRepository
      .createQueryBuilder('cliente')
      .innerJoin('cliente.usuariosContacto', 'usuario')
      .where('usuario.usuarioId = :userId', { userId })
      .getMany();

    return empresas.map((c) => c.idCliente);
  }

  /**
   * Lista todas las órdenes de trabajo de las empresas a las que pertenece un usuario cliente.
   */
  async getWorkOrdersForClientUser(userId: number): Promise<WorkOrder[]> {
    const empresaIds = await this.getEmpresaIdsForClientUser(userId);
    if (!empresaIds.length) return [];

    return await this.workOrdersRepository
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
        `
        CASE
          WHEN workOrder.estado = :unassigned THEN 1
          WHEN workOrder.estado = :assigned THEN 2
          WHEN workOrder.estado = :inProgress THEN 3
          WHEN workOrder.estado = :paused THEN 4
          WHEN workOrder.estado = :completed THEN 5
          WHEN workOrder.estado = :canceled THEN 6
          ELSE 7
        END
      `,
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

  /**
   * Verifica si un usuario cliente tiene acceso a una empresa concreta.
   */
  async userHasAccessToEmpresa(
    userId: number,
    empresaId?: number,
  ): Promise<boolean> {
    if (!empresaId) {
      // Si la orden no tiene empresa asociada, considera que NO tiene acceso
      return false;
    }

    const empresaIds = await this.getEmpresaIdsForClientUser(userId);
    return empresaIds.includes(empresaId);
  }

  private isAirConditioningService(workOrder: WorkOrder): boolean {
    return (
      workOrder.service?.categoriaServicio?.toLowerCase().trim() ===
      'aires acondicionados'.toLowerCase()
    );
  }

  async createAcInspection(
    ordenId: number,
    phase: AcInspectionPhase,
    dto: CreateAcInspectionDto,
    currentUser: any,
  ) {
    // Buscamos si ya existe una inspección para esta Orden, esta Fase y este Equipo específico
    let inspection = await this.acInspectionRepository.findOne({
      where: {
        workOrderId: ordenId,
        phase,
        equipmentId: dto.equipmentId,
      },
    });

    if (inspection) {
      // Si existe: Actualizamos los valores numéricos y observaciones
      Object.assign(inspection, dto);
      inspection.createdByUserId =
        currentUser.userId ?? inspection.createdByUserId;
    } else {
      // Si no existe: Creamos el registro vinculado al equipo
      inspection = this.acInspectionRepository.create({
        ...dto,
        workOrderId: ordenId,
        phase,
        createdByUserId: currentUser.userId ?? null,
      });
    }

    return await this.acInspectionRepository.save(inspection);
  }

  private async areAllAcInspectionsDone(
    ordenId: number,
    phase: AcInspectionPhase,
  ): Promise<boolean> {
    const order = await this.workOrdersRepository.findOne({
      where: { ordenId },
      relations: ['equipmentWorkOrders'],
    });

    if (!order) return false; // 👈 Solución al error de TS

    const totalEquipments = order.equipmentWorkOrders.length;
    const totalInspections = await this.acInspectionRepository.count({
      where: { workOrderId: ordenId, phase },
    });

    return totalInspections >= totalEquipments;
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

  private async hasAcEvidence(
    ordenId: number,
    phase: WorkOrderEvidencePhase,
  ): Promise<boolean> {
    const count = await this.imageRepository.count({
      where: {
        workOrder: { ordenId },
        evidencePhase: phase,
      },
    });
    return count > 0;
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

    // 1) Permisos según tipo de informe
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

      // Solo órdenes COMPLETADAS
      if (workOrder.estado !== WorkOrderStatus.COMPLETED) {
        throw new BadRequestException(
          `La orden ${id} no está finalizada. Solo se pueden enviar informes de órdenes completadas.`,
        );
      }

      // Validaciones de acceso (igual que en los endpoints de informe PDF)
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

      let buffer: Buffer;
      let filename: string;

      if (dto.reportType === WorkOrderReportType.INTERNAL) {
        buffer = await this.generarInformeOrden(id);
        filename = `OT-${id}-interno.pdf`;
      } else {
        buffer = await this.generarInformeOrdenCliente(id);
        filename = `Informe-Orden-Servicio-${id}-cliente.pdf`;
      }

      attachments.push({ filename, content: buffer });
    }

    // LOG: tamaño total antes de compresión
    const totalBytes = attachments.reduce(
      (sum, att) => sum + att.content.length,
      0,
    );
    const totalMB = totalBytes / (1024 * 1024);

    // 2) Comprimir condicionalmente si supera 30 MB
    const zipName =
      dto.reportType === WorkOrderReportType.INTERNAL
        ? 'informes-internos-ordenes.zip'
        : 'informes-cliente-ordenes.zip';

    const finalAttachments = await this.buildAttachmentsWithOptionalZip(
      attachments,
      zipName,
    );

    // LOG: tamaño después de compresión condicional
    const finalTotalBytes = finalAttachments.reduce(
      (sum, att) => sum + att.content.length,
      0,
    );
    const finalTotalMB = finalTotalBytes / (1024 * 1024);

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

    return {
      sentTo: dto.toEmail,
      attachmentsCount: finalAttachments.length,
    };
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

    // 1. Determinar el conjunto de órdenes base
    let sourceOrders: WorkOrder[] = [];

    if (dto.orderIds && dto.orderIds.length > 0) {
      // Modo filtrado por IDs (opcional)
      for (const id of dto.orderIds) {
        const wo = await this.findOne(id);
        sourceOrders.push(wo);
      }
    } else {
      // Modo AUTOMÁTICO: todas las órdenes COMPLETED
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

    // 2. Validar estado COMPLETED y agrupar por clienteEmpresaId
    const groups = new Map<
      number | null,
      { orders: WorkOrder[]; clienteEmpresaId: number | null }
    >();

    for (const workOrder of sourceOrders) {
      if (workOrder.estado !== WorkOrderStatus.COMPLETED) {
        throw new BadRequestException(
          `La orden ${workOrder.ordenId} no está finalizada. Solo se pueden enviar informes de órdenes completadas.`,
        );
      }

      const clienteEmpresaId = workOrder.clienteEmpresaId ?? null;

      if (!groups.has(clienteEmpresaId)) {
        groups.set(clienteEmpresaId, {
          orders: [],
          clienteEmpresaId,
        });
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

    // 3. Procesar grupo por grupo
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

      const contactos = clienteEmpresa.usuariosContacto || [];
      const emails = contactos
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

      // 4. Generar PDFs cliente para todas las órdenes de este cliente
      const attachments: { filename: string; content: Buffer }[] = [];
      for (const order of group.orders) {
        const buffer = await this.generarInformeOrdenCliente(order.ordenId);
        const filename = `Informe-Orden-Servicio-${order.ordenId}-cliente.pdf`;
        attachments.push({ filename, content: buffer });
      }

      // Compresión condicional si sobrepasa 30 MB
      const zipName = `informes-ordenes-${clienteEmpresa.nombre}.zip`;
      const finalAttachments = await this.buildAttachmentsWithOptionalZip(
        attachments,
        zipName,
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

    return {
      totalClientsNotified: details.length,
      details,
      skipped,
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

    if (totalSize <= this.MAX_EMAIL_ATTACHMENT_BYTES) {
      return attachments;
    }

    const zip = new JSZip();
    for (const att of attachments) {
      zip.file(att.filename, att.content);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    return [
      {
        filename: zipName,
        content: zipBuffer,
      },
    ];
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

      // Validaciones de acceso (similar a sendReportsByEmail)
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

      let buffer: Buffer;
      let filename: string;

      if (reportType === WorkOrderReportType.INTERNAL) {
        buffer = await this.generarInformeOrden(id);
        filename = `OT-${id}-interno.pdf`;
      } else {
        buffer = await this.generarInformeOrdenCliente(id);
        filename = `Informe-Orden-Servicio-${id}-cliente.pdf`;
      }

      attachments.push({ filename, content: buffer });
    }

    // Si solo hay una orden, devolvemos el PDF directamente
    if (attachments.length === 1) {
      const att = attachments[0];
      return {
        buffer: att.content,
        fileName: att.filename,
        contentType: 'application/pdf',
      };
    }

    // Si hay varias órdenes → siempre devolver ZIP en descarga local
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

  private async releaseToolsForOrder(ordenId: number): Promise<void> {
    // Buscar todos los ToolDetail de esa orden
    const toolDetails = await this.toolDetailsRepository.find({
      where: { ordenId },
    });

    if (!toolDetails.length) return;

    const toolIds = toolDetails.map((d) => d.herramientaId);

    // Poner todas esas herramientas en estado DISPONIBLE
    await this.toolRepository.update(
      { herramientaId: In(toolIds) },
      { estado: ToolStatus.DISPONIBLE },
    );
  }
}
