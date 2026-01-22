import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource, In } from 'typeorm';
import { WorkOrder } from './entities/work-order.entity';
import { SupplyDetail } from './entities/supply-detail.entity';
import { ToolDetail } from './entities/tool-detail.entity';
import { EquipmentWorkOrder } from './entities/equipment-work-order.entity';
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
import { ToolStatus, SupplyStatus } from 'src/shared/enums';
import { WorkOrderStatus } from './enums/work-order-status.enum';
import { BillingStatus } from './enums/billing-status.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServiceCategory } from 'src/services/enums/service.enums';

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
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {}

  private getRoleName(currentUser: any): string {
    return currentUser?.role?.nombreRol || currentUser?.role || '';
  }

  async create(dto: CreateWorkOrderDto, currentUser: any): Promise<WorkOrder> {
    const roleName = this.getRoleName(currentUser);

    if (roleName === 'Cliente') {
      dto.clienteId = currentUser.userId;
      const clienteEmpresa = await this.clientsRepository.findOne({
        where: { idUsuarioContacto: currentUser.userId },
      });
      if (clienteEmpresa) {
        dto.clienteEmpresaId = clienteEmpresa.idCliente;
      }
    } else if (roleName === 'Administrador' || roleName === 'Secretaria') {
      if (dto.clienteEmpresaId && !dto.clienteId) {
        const empresa = await this.clientsRepository.findOne({
          where: { idCliente: dto.clienteEmpresaId },
        });
        if (!empresa)
          throw new NotFoundException(
            `Empresa con ID ${dto.clienteEmpresaId} no encontrada`,
          );
        if (!empresa.idUsuarioContacto)
          throw new BadRequestException(
            `La empresa ${empresa.nombre} no tiene un usuario contacto asignado`,
          );
        dto.clienteId = empresa.idUsuarioContacto;
      } else if (dto.clienteId && !dto.clienteEmpresaId) {
        const usuarioCliente = await this.usersRepository.findOne({
          where: { usuarioId: dto.clienteId },
        });
        if (!usuarioCliente)
          throw new BadRequestException(`El usuario no existe`);

        const empresaContacto = await this.clientsRepository.findOne({
          where: { idUsuarioContacto: dto.clienteId },
        });
        if (empresaContacto) {
          dto.clienteEmpresaId = empresaContacto.idCliente;
        }
      } else if (dto.clienteId && dto.clienteEmpresaId) {
        const empresa = await this.clientsRepository.findOne({
          where: { idCliente: dto.clienteEmpresaId },
        });
        if (!empresa)
          throw new NotFoundException(
            `Empresa con ID ${dto.clienteEmpresaId} no encontrada`,
          );
        if (empresa.idUsuarioContacto !== dto.clienteId) {
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
    if (!usuarioCliente)
      throw new NotFoundException(
        `Usuario con ID ${dto.clienteId} no encontrado`,
      );

    if (dto.servicioId) {
      const servicio = await this.servicesRepository.findOne({
        where: { servicioId: dto.servicioId },
      });
      if (!servicio)
        throw new NotFoundException(
          `Servicio con ID ${dto.servicioId} no encontrado`,
        );
    }

    // Validar equipos si se envían
    if (dto.equipmentIds && dto.equipmentIds.length > 0) {
      const equipmentIds = dto.equipmentIds;
      const equipments = await this.equipmentRepository.find({
        where: { equipmentId: In(equipmentIds) },
        relations: ['client'],
      });

      if (equipments.length !== equipmentIds.length) {
        throw new NotFoundException('Uno o más equipos no fueron encontrados');
      }

      for (const equipment of equipments) {
        if (equipment.clientId !== dto.clienteEmpresaId) {
          throw new BadRequestException(
            `El equipo ${equipment.code || equipment.equipmentId} no pertenece al cliente de la orden`,
          );
        }
      }
    }

    dto.estado = dto.estado || WorkOrderStatus.REQUESTED_UNASSIGNED;
    dto.estadoFacturacion = dto.estadoFacturacion || BillingStatus.NOT_BILLED;

    const workOrder = this.workOrdersRepository.create(dto);
    const savedWorkOrder = await this.workOrdersRepository.save(workOrder);

    // Asociar equipos si se especificaron
    if (dto.equipmentIds && dto.equipmentIds.length > 0) {
      const equipmentWorkOrders = dto.equipmentIds.map((equipmentId) =>
        this.equipmentWorkOrderRepository.create({
          workOrderId: savedWorkOrder.ordenId,
          equipmentId,
        }),
      );
      await this.equipmentWorkOrderRepository.save(equipmentWorkOrders);
    }

    this.eventEmitter.emit('work-order.created', {
      workOrderId: savedWorkOrder.ordenId,
      clienteId: savedWorkOrder.clienteId,
      tecnicoId: savedWorkOrder.tecnicoId,
      servicioId: savedWorkOrder.servicioId,
      equipmentIds: dto.equipmentIds || [],
    });

    return this.findOne(savedWorkOrder.ordenId);
  }

  async findAll(): Promise<WorkOrder[]> {
    return this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .leftJoinAndSelect('workOrder.service', 'service')
      .leftJoinAndSelect('workOrder.cliente', 'cliente')
      .leftJoinAndSelect('workOrder.clienteEmpresa', 'clienteEmpresa')
      .leftJoinAndSelect('workOrder.tecnico', 'tecnico')
      .leftJoinAndSelect('workOrder.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .leftJoinAndSelect('workOrder.supplyDetails', 'supplyDetails')
      .leftJoinAndSelect('supplyDetails.supply', 'supply')
      .leftJoinAndSelect('workOrder.toolDetails', 'toolDetails')
      .leftJoinAndSelect('toolDetails.tool', 'tool')
      .leftJoinAndSelect('workOrder.maintenanceType', 'maintenanceType')
      .orderBy(
        `
        CASE
          WHEN workOrder.estado = :unassigned THEN 1
          WHEN workOrder.estado = :assigned THEN 2
          WHEN workOrder.estado = :inProgress THEN 3
          WHEN workOrder.estado = :completed THEN 4
          WHEN workOrder.estado = :canceled THEN 5
          ELSE 6
        END
      `,
        'ASC',
      )
      .addOrderBy('workOrder.fechaSolicitud', 'DESC')
      .setParameters({
        unassigned: WorkOrderStatus.REQUESTED_UNASSIGNED,
        assigned: WorkOrderStatus.REQUESTED_ASSIGNED,
        inProgress: WorkOrderStatus.IN_PROGRESS,
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
      .leftJoinAndSelect('workOrder.tecnico', 'tecnico')
      .leftJoinAndSelect('workOrder.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .leftJoinAndSelect('workOrder.supplyDetails', 'supplyDetails')
      .leftJoinAndSelect('supplyDetails.supply', 'supply')
      .leftJoinAndSelect('workOrder.toolDetails', 'toolDetails')
      .leftJoinAndSelect('toolDetails.tool', 'tool')
      .leftJoinAndSelect('workOrder.maintenanceType', 'maintenanceType')
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
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(id);
    const currentRoleName = this.getRoleName(currentUser);

    if (
      currentRoleName === 'Técnico' &&
      workOrder.tecnicoId !== currentUser.userId
    ) {
      throw new ForbiddenException(
        'No tiene permiso para actualizar esta orden',
      );
    }

    if (currentRoleName !== 'Administrador') {
      updateWorkOrderDto.tecnicoId = undefined;
    }

    if (
      updateWorkOrderDto.estado === WorkOrderStatus.CANCELED &&
      currentRoleName !== 'Administrador'
    ) {
      throw new ForbiddenException(
        'Solo el Administrador puede cancelar órdenes por este endpoint',
      );
    }

    if (updateWorkOrderDto.estado) {
      this.validateEstadoTransition(
        workOrder.estado,
        updateWorkOrderDto.estado,
      );
    }

    if (
      updateWorkOrderDto.estado === WorkOrderStatus.COMPLETED &&
      !workOrder.fechaFinalizacion
    ) {
      updateWorkOrderDto.fechaFinalizacion = new Date();
    }

    if (
      updateWorkOrderDto.estado === WorkOrderStatus.IN_PROGRESS &&
      !workOrder.fechaInicio
    ) {
      updateWorkOrderDto.fechaInicio = new Date();
    }

    // Manejar actualización de equipos si se envía
    if (updateWorkOrderDto.equipmentIds !== undefined) {
      await this.equipmentWorkOrderRepository.delete({
        workOrderId: id,
      });

      if (updateWorkOrderDto.equipmentIds.length > 0) {
        const equipmentWorkOrders = updateWorkOrderDto.equipmentIds.map(
          (equipmentId) => ({
            workOrderId: id,
            equipmentId,
          }),
        );
        await this.equipmentWorkOrderRepository.save(equipmentWorkOrders);
      }
    }

    await this.workOrdersRepository.update(id, updateWorkOrderDto);

    this.eventEmitter.emit('work-order.updated', {
      ordenId: id,
      action: 'update',
    });

    return await this.findOne(id);
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

    this.validateEstadoTransition(workOrder.estado, WorkOrderStatus.CANCELED);

    workOrder.estado = WorkOrderStatus.CANCELED;
    if (!workOrder.fechaFinalizacion) {
      workOrder.fechaFinalizacion = new Date();
    }

    await this.workOrdersRepository.save(workOrder);

    this.eventEmitter.emit('work-order.updated', {
      ordenId: id,
      action: 'cancel',
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
      await queryRunner.manager.remove(workOrder);

      await queryRunner.commitTransaction();
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
    const nuevoEstado =
      workOrder.estado === WorkOrderStatus.REQUESTED_UNASSIGNED
        ? WorkOrderStatus.REQUESTED_ASSIGNED
        : workOrder.estado;

    await this.workOrdersRepository.update(ordenId, {
      tecnicoId,
      estado: nuevoEstado,
    });

    const updated = await this.findOne(ordenId);
    this.eventEmitter.emit('work-order.assigned', {
      workOrderId: updated.ordenId,
      tecnicoId: updated.tecnicoId,
      clienteId: updated.clienteId,
      servicioId: updated.servicioId,
    });

    this.eventEmitter.emit('work-order.updated', {
      ordenId,
      action: 'assignTechnician',
    });

    return updated;
  }

  async unassignTechnician(ordenId: number): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);

    if (!workOrder.tecnicoId) {
      throw new ConflictException('La orden no tiene técnico asignado');
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

    await this.workOrdersRepository.update(ordenId, {
      tecnicoId: null as any,
      estado: nuevoEstado,
    });

    this.eventEmitter.emit('work-order.updated', {
      ordenId,
      action: 'unassignTechnician',
    });

    return this.findOne(ordenId);
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
  }

  async getWorkOrdersByEquipment(equipmentId: number): Promise<WorkOrder[]> {
    const equipmentWorkOrders = await this.equipmentWorkOrderRepository.find({
      where: { equipmentId },
      relations: [
        'workOrder',
        'workOrder.service',
        'workOrder.cliente',
        'workOrder.clienteEmpresa',
        'workOrder.tecnico',
        'workOrder.maintenanceType',
      ],
      order: { createdAt: 'DESC' },
    });

    return equipmentWorkOrders.map((ewo) => ewo.workOrder);
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
      .leftJoinAndSelect('workOrder.tecnico', 'tecnico')
      .leftJoinAndSelect('workOrder.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .leftJoinAndSelect('workOrder.supplyDetails', 'supplyDetails')
      .leftJoinAndSelect('supplyDetails.supply', 'supply')
      .leftJoinAndSelect('workOrder.toolDetails', 'toolDetails')
      .leftJoinAndSelect('toolDetails.tool', 'tool')
      .leftJoinAndSelect('workOrder.maintenanceType', 'maintenanceType')
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
      .leftJoinAndSelect('workOrder.tecnico', 'tecnico')
      .leftJoinAndSelect('workOrder.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .leftJoinAndSelect('workOrder.supplyDetails', 'supplyDetails')
      .leftJoinAndSelect('supplyDetails.supply', 'supply')
      .leftJoinAndSelect('workOrder.toolDetails', 'toolDetails')
      .leftJoinAndSelect('toolDetails.tool', 'tool')
      .leftJoinAndSelect('workOrder.maintenanceType', 'maintenanceType')
      .where('workOrder.clienteId = :clienteId', { clienteId })
      .orderBy(
        `
        CASE
          WHEN workOrder.estado = :unassigned THEN 1
          WHEN workOrder.estado = :assigned THEN 2
          WHEN workOrder.estado = :inProgress THEN 3
          WHEN workOrder.estado = :completed THEN 4
          WHEN workOrder.estado = :canceled THEN 5
          ELSE 6
        END
      `,
        'ASC',
      )
      .addOrderBy('workOrder.fechaSolicitud', 'DESC')
      .setParameters({
        unassigned: WorkOrderStatus.REQUESTED_UNASSIGNED,
        assigned: WorkOrderStatus.REQUESTED_ASSIGNED,
        inProgress: WorkOrderStatus.IN_PROGRESS,
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
      .leftJoinAndSelect('workOrder.tecnico', 'tecnico')
      .leftJoinAndSelect('workOrder.equipmentWorkOrders', 'equipmentWorkOrders')
      .leftJoinAndSelect('equipmentWorkOrders.equipment', 'equipment')
      .leftJoinAndSelect('workOrder.supplyDetails', 'supplyDetails')
      .leftJoinAndSelect('supplyDetails.supply', 'supply')
      .leftJoinAndSelect('workOrder.toolDetails', 'toolDetails')
      .leftJoinAndSelect('toolDetails.tool', 'tool')
      .leftJoinAndSelect('workOrder.maintenanceType', 'maintenanceType')
      .where('workOrder.tecnicoId = :tecnicoId', { tecnicoId })
      .orderBy(
        `
        CASE
          WHEN workOrder.estado = :unassigned THEN 1
          WHEN workOrder.estado = :assigned THEN 2
          WHEN workOrder.estado = :inProgress THEN 3
          WHEN workOrder.estado = :completed THEN 4
          WHEN workOrder.estado = :canceled THEN 5
          ELSE 6
        END
      `,
        'ASC',
      )
      .addOrderBy('workOrder.fechaSolicitud', 'DESC')
      .setParameters({
        unassigned: WorkOrderStatus.REQUESTED_UNASSIGNED,
        assigned: WorkOrderStatus.REQUESTED_ASSIGNED,
        inProgress: WorkOrderStatus.IN_PROGRESS,
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
        'tecnico',
        'equipmentWorkOrders',
        'equipmentWorkOrders.equipment',
        'supplyDetails',
        'supplyDetails.supply',
        'toolDetails',
        'toolDetails.tool',
        'maintenanceType',
      ],
      order: { fechaSolicitud: 'DESC' },
    });
  }

  // Añadir este nuevo método en WorkOrdersService:
  async getWorkOrdersByClientAndCategory(
    clienteEmpresaId: number,
    category: string,
  ): Promise<WorkOrder[]> {
    // Primero, verifica si hay servicios con esa categoría
    const serviciosConCategoria = await this.servicesRepository.find({
      where: { categoriaServicio: category as ServiceCategory },
    });

    // Luego haz la consulta principal
    const workOrders = await this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .leftJoinAndSelect('workOrder.service', 'service')
      .leftJoinAndSelect('workOrder.clienteEmpresa', 'clienteEmpresa')
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
        WorkOrderStatus.COMPLETED,
        WorkOrderStatus.CANCELED,
      ],
      [WorkOrderStatus.COMPLETED]: [],
      [WorkOrderStatus.CANCELED]: [],
    };

    if (!validTransitions[currentEstado]?.includes(newEstado)) {
      throw new BadRequestException(
        `Transición de estado inválida: ${currentEstado} -> ${newEstado}`,
      );
    }
  }

  async calculateTotalCost(
    ordenId: number,
  ): Promise<{ costoTotalInsumos: number }> {
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

    return {
      costoTotalInsumos,
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

    if (workOrder.estadoFacturacion === BillingStatus.BILLED) {
      throw new BadRequestException('La orden ya está facturada');
    }

    workOrder.facturaPdfUrl = `/api/uploads/invoices/${file.filename}`;
    workOrder.estadoFacturacion = BillingStatus.BILLED;

    await this.workOrdersRepository.save(workOrder);
    return this.findOne(ordenId);
  }
}
