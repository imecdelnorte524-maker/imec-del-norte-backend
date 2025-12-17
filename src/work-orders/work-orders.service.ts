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
   * Crea una orden de trabajo ajustando el cliente/empresa según el rol:
   * - Cliente:
   *    - No envía clienteEmpresaId.
   *    - Se busca automáticamente la(s) empresa(s) donde idUsuarioContacto = userId.
   *    - Si tiene una empresa, se usa esa.
   *    - Si no tiene ninguna, se lanza Forbidden para que el frontend muestre botón "Crear empresa".
   * - Administrador:
   *    - Debe enviar clienteEmpresaId.
   *    - Si no envía clienteId, se usa idUsuarioContacto del cliente empresa.
   */
  async create(
    createWorkOrderDto: CreateWorkOrderDto,
    currentUser: any,
  ): Promise<WorkOrder> {
    const service = await this.servicesRepository.findOne({
      where: { servicioId: createWorkOrderDto.servicioId },
    });
    if (!service) {
      throw new NotFoundException(
        `Servicio con ID ${createWorkOrderDto.servicioId} no encontrado`,
      );
    }

    const currentRoleName = this.getRoleName(currentUser);

    let clienteEmpresa: Client | null = null;

    // === LÓGICA PARA CLIENTE ===
    if (currentRoleName === 'Cliente') {
      // Buscar empresas donde este usuario es el contacto
      const companies = await this.clientsRepository.find({
        where: { idUsuarioContacto: currentUser.userId },
      });

      if (!companies.length) {
        // Aquí el frontend puede detectar este mensaje y mostrar el botón "Crear empresa"
        throw new ForbiddenException(
          'No tiene una empresa registrada. Debe crear una empresa antes de solicitar una orden de servicio.',
        );
      }

      if (companies.length === 1) {
        clienteEmpresa = companies[0];
      } else {
        // Si en tu modelo un cliente puede ser contacto de varias empresas,
        // aquí podrías permitir que envíe clienteEmpresaId y validarlo.
        if (createWorkOrderDto.clienteEmpresaId) {
          const selected = companies.find(
            (c) => c.idCliente === createWorkOrderDto.clienteEmpresaId,
          );
          if (!selected) {
            throw new ForbiddenException(
              'No tiene permiso para crear órdenes para esta empresa',
            );
          }
          clienteEmpresa = selected;
        } else {
          throw new ForbiddenException(
            'Tiene más de una empresa asociada. Debe seleccionar la empresa para la orden de servicio.',
          );
        }
      }

      // Forzamos la empresa y el cliente en el DTO
      createWorkOrderDto.clienteEmpresaId = clienteEmpresa.idCliente;
      createWorkOrderDto.clienteId = currentUser.userId;
    }

    // === LÓGICA PARA ADMIN (u otros roles con permiso futuro) ===
    else {
      if (!createWorkOrderDto.clienteEmpresaId) {
        throw new BadRequestException(
          'El ID del cliente empresa es requerido',
        );
      }

      clienteEmpresa = await this.clientsRepository.findOne({
        where: { idCliente: createWorkOrderDto.clienteEmpresaId },
      });
      if (!clienteEmpresa) {
        throw new NotFoundException(
          `Cliente empresa con ID ${createWorkOrderDto.clienteEmpresaId} no encontrado`,
        );
      }

      // Si no se envía clienteId, usar el usuarioContacto de la empresa
      if (!createWorkOrderDto.clienteId) {
        createWorkOrderDto.clienteId = clienteEmpresa.idUsuarioContacto;
      }
    }

    // Validar cliente (usuario)
    const cliente = await this.usersRepository.findOne({
      where: { usuarioId: createWorkOrderDto.clienteId },
    });
    if (!cliente) {
      throw new NotFoundException(
        `Cliente (usuario) con ID ${createWorkOrderDto.clienteId} no encontrado`,
      );
    }

    // Validar técnico si viene
    if (createWorkOrderDto.tecnicoId) {
      const tecnico = await this.usersRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .where('user.usuarioId = :id', { id: createWorkOrderDto.tecnicoId })
        .andWhere('role.nombreRol = :rol', { rol: 'Técnico' })
        .getOne();

      if (!tecnico) {
        throw new NotFoundException(
          `Técnico con ID ${createWorkOrderDto.tecnicoId} no encontrado o no tiene rol Técnico`,
        );
      }
    }

    // Validar equipo si viene
    if (createWorkOrderDto.equipoId) {
      const equipment = await this.equipmentRepository.findOne({
        where: { equipmentId: createWorkOrderDto.equipoId },
      });
      if (!equipment) {
        throw new NotFoundException(
          `Equipo con ID ${createWorkOrderDto.equipoId} no encontrado`,
        );
      }
    }

    const estadoInicial = createWorkOrderDto.tecnicoId
      ? WorkOrderStatus.REQUESTED_ASSIGNED
      : WorkOrderStatus.REQUESTED_UNASSIGNED;

    const workOrder = this.workOrdersRepository.create({
      ...createWorkOrderDto,
      estado: estadoInicial,
    });

    const saved = await this.workOrdersRepository.save(workOrder);

    // Recargar la orden con todas las relaciones
    return await this.findOne(saved.ordenId);
  }

  async findAll(): Promise<WorkOrder[]> {
    return await this.workOrdersRepository.find({
      relations: [
        'service',
        'cliente',
        'clienteEmpresa',
        'tecnico',
        'equipment',
        'supplyDetails',
        'supplyDetails.supply',
        'toolDetails',
        'toolDetails.tool',
      ],
      order: { fechaSolicitud: 'DESC' },
    });
  }

  async findOne(id: number): Promise<WorkOrder> {
    const workOrder = await this.workOrdersRepository.findOne({
      where: { ordenId: id },
      relations: [
        'service',
        'cliente',
        'clienteEmpresa',
        'tecnico',
        'equipment',
        'supplyDetails',
        'supplyDetails.supply',
        'toolDetails',
        'toolDetails.tool',
      ],
    });

    if (!workOrder) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${id} no encontrada`,
      );
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
      throw new ForbiddenException(
        'No tiene permiso para cancelar esta orden',
      );
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

  async assignTechnician(
    ordenId: number,
    tecnicoId: number,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(ordenId);

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

    workOrder.tecnicoId = tecnicoId;

    if (workOrder.estado === WorkOrderStatus.REQUESTED_UNASSIGNED) {
      workOrder.estado = WorkOrderStatus.REQUESTED_ASSIGNED;
    }

    await this.workOrdersRepository.save(workOrder);
    return await this.findOne(ordenId);
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
    return await this.workOrdersRepository.find({
      where: { estado: estado as WorkOrderStatus },
      relations: [
        'service',
        'cliente',
        'clienteEmpresa',
        'tecnico',
        'equipment',
      ],
      order: { fechaSolicitud: 'DESC' },
    });
  }

  async getWorkOrdersByClient(clienteId: number): Promise<WorkOrder[]> {
    return await this.workOrdersRepository.find({
      where: { clienteId },
      relations: [
        'service',
        'cliente',
        'tecnico',
        'clienteEmpresa',
        'equipment',
      ],
      order: { fechaSolicitud: 'DESC' },
    });
  }

  async getWorkOrdersByTechnician(tecnicoId: number): Promise<WorkOrder[]> {
    return await this.workOrdersRepository.find({
      where: { tecnicoId },
      relations: [
        'service',
        'cliente',
        'clienteEmpresa',
        'tecnico',
        'equipment',
      ],
      order: { fechaSolicitud: 'DESC' },
    });
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
        'equipment',
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
}