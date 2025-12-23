import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { WorkOrder } from './entities/work-order.entity';
import { SupplyDetail } from './entities/supply-detail.entity';
import { ToolDetail } from './entities/tool-detail.entity';
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

@Injectable()
export class WorkOrdersService {
  constructor(
    @InjectRepository(WorkOrder)
    private workOrdersRepository: Repository<WorkOrder>,
    @InjectRepository(SupplyDetail)
    private supplyDetailsRepository: Repository<SupplyDetail>,
    @InjectRepository(ToolDetail)
    private toolDetailsRepository: Repository<ToolDetail>,
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
  ) {}

  private getRoleName(currentUser: any): string {
    return currentUser?.role?.nombreRol || currentUser?.role || '';
  }

  /**
   * Crea una orden de trabajo.
   */
  async create(
    dto: CreateWorkOrderDto,
    currentUser: any,
  ): Promise<WorkOrder> {
    const workOrder = this.workOrdersRepository.create(dto);
    const saved = await this.workOrdersRepository.save(workOrder);
    return this.findOne(saved.ordenId);
  }

  /**
   * Lista todas las órdenes de trabajo con prioridad:
   * 1) Solicitada sin asignar
   * 2) Solicitada asignada
   * 3) En proceso
   * 4) Finalizada
   * 5) Cancelada
   * Dentro de cada grupo, ordenadas por fechaSolicitud DESC.
   */
  async findAll(): Promise<WorkOrder[]> {
    return this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .leftJoinAndSelect('workOrder.service', 'service')
      .leftJoinAndSelect('workOrder.cliente', 'cliente')
      .leftJoinAndSelect('workOrder.clienteEmpresa', 'clienteEmpresa')
      .leftJoinAndSelect('workOrder.tecnico', 'tecnico')
      .leftJoinAndSelect('workOrder.equipments', 'equipments')
      .leftJoinAndSelect('workOrder.supplyDetails', 'supplyDetails')
      .leftJoinAndSelect('supplyDetails.supply', 'supply')
      .leftJoinAndSelect('workOrder.toolDetails', 'toolDetails')
      .leftJoinAndSelect('toolDetails.tool', 'tool')
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
    const workOrder = await this.workOrdersRepository.findOne({
      where: { ordenId: id },
      relations: [
        'service',
        'cliente',
        'clienteEmpresa',
        'tecnico',
        'equipments',
        'supplyDetails',
        'supplyDetails.supply',
        'toolDetails',
        'toolDetails.tool',
      ],
    });

    if (!workOrder) {
      throw new NotFoundException(`Orden ${id} no encontrada`);
    }

    return workOrder;
  }

  /**
   * Actualiza una orden de trabajo.
   * - Técnico solo puede actualizar órdenes asignadas a él.
   * - Solo Administrador puede cambiar el técnico (tecnicoId).
   * - Solo Administrador puede cancelar por este endpoint (clientes tienen su endpoint propio).
   */
  async update(
    id: number,
    updateWorkOrderDto: UpdateWorkOrderDto,
    currentUser: any,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(id);
    const currentRoleName = this.getRoleName(currentUser);

    // Técnico solo puede actualizar sus órdenes
    if (
      currentRoleName === 'Técnico' &&
      workOrder.tecnicoId !== currentUser.userId
    ) {
      throw new ForbiddenException(
        'No tiene permiso para actualizar esta orden',
      );
    }

    // Solo Administrador puede cambiar el técnico de la orden
    if (currentRoleName !== 'Administrador') {
      updateWorkOrderDto.tecnicoId = undefined;
    }

    // Solo Administrador puede cancelar por este endpoint
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

    await this.workOrdersRepository.update(id, updateWorkOrderDto);
    return await this.findOne(id);
  }

  /**
   * Cancelación por parte del CLIENTE (máx. 3 días hábiles).
   */
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

    // Validar ventana de 3 días hábiles
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
      // Restaurar stock de insumos usados
      const supplyDetails = await this.supplyDetailsRepository.find({
        where: { ordenId: id },
        relations: ['supply'],
      });

      for (const detail of supplyDetails) {
        const inventory = await queryRunner.manager.findOne(Inventory, {
          where: { insumoId: detail.insumoId },
        });

        if (inventory) {
          inventory.cantidadActual += detail.cantidadUsada;
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

      // Restaurar estado de herramientas usadas
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

      // Eliminar detalles
      await queryRunner.manager.delete(SupplyDetail, { ordenId: id });
      await queryRunner.manager.delete(ToolDetail, { ordenId: id });

      // Eliminar la orden
      await queryRunner.manager.remove(workOrder);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Asigna o cambia el técnico de una orden.
   * - Valida que exista un usuario con rol "Técnico".
   * - Si la orden estaba "Solicitada sin asignar", pasa a "Solicitada asignada".
   * - Usa UPDATE directo para evitar conflictos con la relación cargada.
   */
  async assignTechnician(
    ordenId: number,
    tecnicoId: number,
  ): Promise<WorkOrder> {
    // Validar que el técnico exista y tenga rol "Técnico"
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

    // Obtener la orden para conocer su estado actual
    const workOrder = await this.findOne(ordenId);

    const nuevoEstado =
      workOrder.estado === WorkOrderStatus.REQUESTED_UNASSIGNED
        ? WorkOrderStatus.REQUESTED_ASSIGNED
        : workOrder.estado;

    // UPDATE directo
    await this.workOrdersRepository.update(ordenId, {
      tecnicoId,
      estado: nuevoEstado,
    });

    return this.findOne(ordenId);
  }

  /**
   * Quita el técnico de una orden de trabajo.
   * - No permite quitar técnico si la orden está En proceso, Finalizada o Cancelada.
   * - Si la orden estaba "Solicitada asignada", se devuelve a "Solicitada sin asignar".
   * - Usa UPDATE directo para poner tecnico_id en NULL.
   */
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

    return this.findOne(ordenId);
  }

  async addSupplyDetail(
    ordenId: number,
    addSupplyDetailDto: AddSupplyDetailDto,
  ): Promise<SupplyDetail> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

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

      if (supply.inventory.cantidadActual < addSupplyDetailDto.cantidadUsada) {
        throw new ConflictException(
          `Stock insuficiente. Disponible: ${supply.inventory.cantidadActual}, Solicitado: ${addSupplyDetailDto.cantidadUsada}`,
        );
      }

      const supplyDetail = queryRunner.manager.create(SupplyDetail, {
        ...addSupplyDetailDto,
        ordenId,
        costoUnitarioAlMomento:
          addSupplyDetailDto.costoUnitarioAlMomento || supply.valorUnitario,
      });

      const savedDetail = await queryRunner.manager.save(supplyDetail);

      // Actualizar stock en inventario
      supply.inventory.cantidadActual -= addSupplyDetailDto.cantidadUsada;
      supply.inventory.fechaUltimaActualizacion = new Date();
      await queryRunner.manager.save(supply.inventory);

      // Actualizar estado del insumo
      const nuevoStock = supply.inventory.cantidadActual;
      const estado = this.calculateSupplyStatus(nuevoStock, supply.stockMin);
      await queryRunner.manager.update(
        Supply,
        { insumoId: supply.insumoId },
        { estado },
      );

      await queryRunner.commitTransaction();
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
        throw new NotFoundException('Detalle de insumo no encontrado');
      }

      if (supplyDetail.supply?.inventory) {
        supplyDetail.supply.inventory.cantidadActual +=
          supplyDetail.cantidadUsada;
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
        throw new NotFoundException('Detalle de herramienta no encontrado');
      }

      await queryRunner.manager.update(
        Tool,
        { herramientaId: toolDetail.herramientaId },
        { estado: ToolStatus.DISPONIBLE },
      );

      await queryRunner.manager.remove(toolDetail);

      await queryRunner.commitTransaction();
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
      .leftJoinAndSelect('workOrder.equipments', 'equipments')
      .where('workOrder.estado = :estado', {
        estado: estado as WorkOrderStatus,
      })
      .orderBy(
        `
      CASE
        WHEN workOrder.estado = :pendiente THEN 1
        ELSE 2
      END
      `,
        'ASC',
      )
      .setParameter('pendiente', WorkOrderStatus.REQUESTED_UNASSIGNED)
      .addOrderBy('workOrder.fechaSolicitud', 'DESC')
      .getMany();
  }

  /**
   * Órdenes por cliente, con misma prioridad de estados.
   */
  async getWorkOrdersByClient(clienteId: number): Promise<WorkOrder[]> {
    return await this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .leftJoinAndSelect('workOrder.service', 'service')
      .leftJoinAndSelect('workOrder.cliente', 'cliente')
      .leftJoinAndSelect('workOrder.clienteEmpresa', 'clienteEmpresa')
      .leftJoinAndSelect('workOrder.tecnico', 'tecnico')
      .leftJoinAndSelect('workOrder.equipments', 'equipments')
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

  /**
   * Órdenes por técnico, con misma prioridad de estados.
   */
  async getWorkOrdersByTechnician(tecnicoId: number): Promise<WorkOrder[]> {
    return await this.workOrdersRepository
      .createQueryBuilder('workOrder')
      .leftJoinAndSelect('workOrder.service', 'service')
      .leftJoinAndSelect('workOrder.cliente', 'cliente')
      .leftJoinAndSelect('workOrder.clienteEmpresa', 'clienteEmpresa')
      .leftJoinAndSelect('workOrder.tecnico', 'tecnico')
      .leftJoinAndSelect('workOrder.equipments', 'equipments')
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
        'equipments',
      ],
      order: { fechaSolicitud: 'DESC' },
    });
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
      .select(
        'SUM(service.precio_base + COALESCE(supplyDetails.cantidad_usada * supplyDetails.costo_unitario_al_momento, 0))',
        'total',
      )
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

  private validateEstadoTransition(
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
  ): Promise<{ costoTotalInsumos: number; costoTotalEstimado: number }> {
    const workOrder = await this.findOne(ordenId);

    let costoTotalInsumos = 0;
    if (workOrder.supplyDetails) {
      costoTotalInsumos = workOrder.supplyDetails.reduce((total, detail) => {
        return (
          total + detail.cantidadUsada * (detail.costoUnitarioAlMomento || 0)
        );
      }, 0);
    }

    const costoTotalEstimado =
      (workOrder.service?.precioBase || 0) + costoTotalInsumos;

    return {
      costoTotalInsumos,
      costoTotalEstimado,
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

  /**
   * Suma días hábiles (sin contar sábados ni domingos).
   */
  private addBusinessDays(date: Date, businessDays: number): Date {
    const result = new Date(date);
    let added = 0;

    while (added < businessDays) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay(); // 0=Domingo, 6=Sábado
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