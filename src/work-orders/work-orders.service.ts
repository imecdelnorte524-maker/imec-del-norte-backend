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
import { ToolStatus, SupplyStatus } from '../shared/enums';
import { WorkOrderStatus } from './enums/work-order-status.enum';
import { BillingStatus } from './enums/billing-status.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServiceCategory } from '../services/enums/service.enums';
import { PlanMantenimiento } from '../equipment/entities/plan-mantenimiento.entity';
import { CreateEmergencyOrderDto } from './dto/create-emergency-order.dto';
import { AssignTechniciansDto } from './dto/assign-technicians.dto';
import { WebsocketGateway } from '../websockets/websocket.gateway';
import { RateTechniciansDto } from './dto/rate-technicians.dto';
import { SignWorkOrderDto } from './dto/sign-work-order.dto';
import { AcInspection } from './entities/ac-inspection.entity';
import {
  AcInspectionPhase,
  WorkOrderEvidencePhase,
} from './enums/ac-inspection-phase.enum';
import { CreateAcInspectionDto } from './dto/create-ac-inspection.dto';
import { Image } from 'src/images/entities/image.entity';

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
    private readonly websocketGateway: WebsocketGateway,
  ) {}

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
    this.websocketGateway.emit('workOrders.created', full);

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

    // --- 1. VALIDACIONES ESPECÍFICAS AC POR EQUIPO ---
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

    // --- 2. BLOQUEOS DE SEGURIDAD (FACTURACIÓN Y ROLES) ---
    if (
      workOrder.estadoFacturacion !== null &&
      workOrder.estadoFacturacion !== undefined
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
      // Validar que todos los técnicos estén calificados si se va a poner un estado de facturación
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

    // --- 3. TRANSICIONES Y FIRMA ---
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

    // --- 4. MANEJO DE CRONÓMETRO Y PAUSAS ---
    if (
      updateWorkOrderDto.estado === WorkOrderStatus.IN_PROGRESS &&
      !workOrder.fechaInicio
    ) {
      updateWorkOrderDto.fechaInicio = this.getColombiaTime();
      await this.startTimer(id, currentUser.userId);
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

    // --- 5. ACTUALIZACIÓN DE RELACIONES (EQUIPOS Y TÉCNICOS) ---
    if (updateWorkOrderDto.equipmentIds !== undefined) {
      if (!workOrder.clienteEmpresaId)
        throw new BadRequestException('La orden no tiene cliente asignado');
      await this.updateEquipmentAssociations(
        id,
        updateWorkOrderDto.equipmentIds,
        workOrder.clienteEmpresaId,
      );
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
    }

    const {
      pauseObservation,
      equipmentIds,
      technicianIds,
      leaderTechnicianId,
      tecnicoId,
      ...columnData
    } = updateWorkOrderDto;

    if (Object.keys(columnData).length > 0) {
      await this.workOrdersRepository.update(id, columnData);
    }

    this.eventEmitter.emit('work-order.updated', {
      ordenId: id,
      action: 'update',
    });

    // 🔴 WebSocket
    await this.emitWorkOrderUpdated(id, {
      previousStatus: workOrder.estado,
      clientId, // 👈 Pasar el clientId
    });

    return this.findOne(id);
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
        const inventory = await queryRunner.manager.findOne(Inventory, {
          where: { insumoId: detail.insumoId },
        });

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
      this.websocketGateway.emit('workOrders.deleted', { id });
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

    this.websocketGateway.emit('workOrders.emergencyCreated', {
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
      await this.findOne(ordenId);

      const supply = await queryRunner.manager.findOne(Supply, {
        where: { insumoId: addSupplyDetailDto.insumoId },
        relations: ['inventory'],
      });

      if (!supply) {
        throw new NotFoundException(
          `Insumo con ID ${addSupplyDetailDto.insumoId} no encontrado`,
        );
      }

      if (!supply.inventory) {
        throw new NotFoundException(
          `Inventario para insumo ID ${addSupplyDetailDto.insumoId} no encontrado`,
        );
      }

      const cantidadActual = Number(supply.inventory.cantidadActual);
      const cantidadSolicitada = Number(addSupplyDetailDto.cantidadUsada);

      if (cantidadActual < cantidadSolicitada) {
        throw new ConflictException(
          `Stock insuficiente. Disponible: ${cantidadActual}, Solicitado: ${cantidadSolicitada}`,
        );
      }

      const supplyDetail = queryRunner.manager.create(SupplyDetail, {
        ...addSupplyDetailDto,
        ordenId,
        costoUnitarioAlMomento:
          addSupplyDetailDto.costoUnitarioAlMomento || supply.valorUnitario,
      });

      const savedDetail = await queryRunner.manager.save(supplyDetail);

      supply.inventory.cantidadActual = cantidadActual - cantidadSolicitada;
      supply.inventory.fechaUltimaActualizacion = new Date();
      await queryRunner.manager.save(supply.inventory);

      const estadoAnterior = supply.estado;
      const nuevoStock = supply.inventory.cantidadActual;
      const estado = this.calculateSupplyStatus(nuevoStock, supply.stockMin);

      await queryRunner.manager.update(
        Supply,
        { insumoId: supply.insumoId },
        { estado },
      );

      if (
        estado !== estadoAnterior &&
        (estado === SupplyStatus.STOCK_BAJO || estado === SupplyStatus.AGOTADO)
      ) {
        shouldEmitStockBelowMin = true;
        belowMinEventPayload = {
          insumoId: supply.insumoId,
          nombre: supply.nombre,
          cantidadActual: Number(nuevoStock),
          stockMin: supply.stockMin,
        };
      }

      await queryRunner.commitTransaction();

      if (shouldEmitStockBelowMin && belowMinEventPayload) {
        this.eventEmitter.emit('stock.below-min', belowMinEventPayload);
      }

      this.eventEmitter.emit('work-order.updated', {
        ordenId,
        action: 'addSupply',
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
        relations: ['supply', 'supply.inventory'],
      });

      if (!supplyDetail) {
        throw new NotFoundException(
          'Detalle de insumo no encontrado en esta orden',
        );
      }

      if (supplyDetail.supply?.inventory) {
        const cantidadUsada = Number(supplyDetail.cantidadUsada);
        const cantidadActual = Number(
          supplyDetail.supply.inventory.cantidadActual,
        );

        supplyDetail.supply.inventory.cantidadActual =
          cantidadActual + cantidadUsada;
        supplyDetail.supply.inventory.fechaUltimaActualizacion = new Date();

        await queryRunner.manager.save(supplyDetail.supply.inventory);

        const nuevoStock = supplyDetail.supply.inventory.cantidadActual;
        const estado = this.calculateSupplyStatus(
          nuevoStock,
          supplyDetail.supply.stockMin,
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

      // 🔴 WebSocket
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

  async uploadInvoice(
    ordenId: number,
    file: Express.Multer.File,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);

    if (workOrder.estado !== WorkOrderStatus.COMPLETED) {
      throw new BadRequestException(
        'Solo se puede facturar una orden que esté Finalizada',
      );
    }

    // 🔹 NUEVO: exigir técnicos calificados antes de facturar
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

    if (
      workOrder.estadoFacturacion !== BillingStatus.NOT_BILLED &&
      workOrder.facturaPdfUrl
    ) {
      throw new BadRequestException(
        'La orden ya tiene un estado de facturación asignado',
      );
    }

    workOrder.facturaPdfUrl = `/api/uploads/invoices/${file.filename}`;
    workOrder.estadoFacturacion = BillingStatus.BILLED;

    await this.workOrdersRepository.save(workOrder);

    const updated = await this.findOne(ordenId);

    // 🔴 WebSocket
    this.websocketGateway.emit('workOrders.updated', updated);
    this.websocketGateway.emit('workOrders.invoiceUpdated', updated);

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

    const clienteEmpresa = await this.clientsRepository.findOne({
      where: { idCliente: equipment.clientId },
      relations: ['usuariosContacto'],
    });

    if (!clienteEmpresa) {
      throw new NotFoundException(
        `Cliente empresa ${equipment.clientId} del equipo ${equipment.equipmentId} no encontrado`,
      );
    }

    const primerContacto = this.getPrimerUsuarioContacto(clienteEmpresa);
    if (!primerContacto) {
      throw new BadRequestException(
        `El cliente empresa ${clienteEmpresa.nombre} no tiene usuarios contacto asignados`,
      );
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
        clienteId: primerContacto.usuarioId,
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

      // 🔴 WebSocket
      this.websocketGateway.emit('workOrders.created', full);

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
      clientId?: string; // 👈 Nuevo parámetro opcional
    },
  ): Promise<void> {
    const workOrder = await this.findOne(ordenId);

    // Si hay clientId, emitir también a ese cliente específico
    if (options?.clientId) {
      // Emitir al cliente que hizo la petición
      this.websocketGateway.emitToClient(
        options.clientId,
        'workOrders.updated',
        workOrder,
      );
    }

    // Siempre emitir a todos (para otros clientes)
    this.websocketGateway.emitToAll('workOrders.updated', workOrder);

    // Cambio de estado - emitir a todos
    if (
      options?.previousStatus &&
      options.previousStatus !== workOrder.estado
    ) {
      this.websocketGateway.emitToAll('workOrders.statusUpdated', workOrder);

      // También al cliente específico si quieres
      if (options?.clientId) {
        this.websocketGateway.emitToClient(
          options.clientId,
          'workOrders.statusUpdated',
          workOrder,
        );
      }
    }

    // Cambio de técnicos asignados
    if (options?.emitAssigned) {
      const assignedData = {
        workOrder,
        technicianIds: workOrder.technicians?.map((t) => t.tecnicoId) ?? [],
      };

      this.websocketGateway.emitToAll('workOrders.assigned', assignedData);

      if (options?.clientId) {
        this.websocketGateway.emitToClient(
          options.clientId,
          'workOrders.assigned',
          assignedData,
        );
      }
    }

    // Evento extra opcional
    if (options?.extraEvent) {
      const extraData = options.extraPayload ?? workOrder;
      this.websocketGateway.emitToAll(options.extraEvent, extraData);

      if (options?.clientId) {
        this.websocketGateway.emitToClient(
          options.clientId,
          options.extraEvent,
          extraData,
        );
      }
    }
  }

  // src/work-orders/work-orders.service.ts

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
}
