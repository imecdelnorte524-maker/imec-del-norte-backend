// src/supplies/supplies.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Not } from 'typeorm';
import { Supply } from './entities/supply.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { UnitMeasure } from '../unit-measure/entities/unit-measure.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';
import { SupplyStatus, SupplyCategory } from '../shared/index';
import { ImagesService } from '../images/images.service';
import { SequenceHelperService } from '../common/services/sequence-helper.service';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';

@Injectable()
export class SuppliesService {
  private readonly logger = new Logger(SuppliesService.name);
  private readonly tableName = 'insumos';
  private readonly idColumn = 'insumo_id';

  constructor(
    @InjectRepository(Supply)
    private suppliesRepository: Repository<Supply>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @InjectRepository(UnitMeasure)
    private unitMeasureRepository: Repository<UnitMeasure>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    private dataSource: DataSource,
    private readonly imagesService: ImagesService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly sequenceHelper: SequenceHelperService,
  ) {
    this.initializeSequence().catch((error) => {
      this.logger.warn(
        `No se pudo inicializar secuencias de insumos: ${error.message}`,
      );
    });
  }

  private async findOrCreateUnitMeasure(
    nombre: string,
    queryRunnerManager: any,
  ): Promise<UnitMeasure> {
    const cleanName = nombre.trim();
    let unit = await queryRunnerManager.findOne(UnitMeasure, {
      where: { nombre: cleanName },
    });

    if (!unit) {
      unit = queryRunnerManager.create(UnitMeasure, { nombre: cleanName });
      unit = await queryRunnerManager.save(unit);
    }

    return unit;
  }

  async create(dto: CreateSupplyDto): Promise<Supply> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.fixSequenceIfNeeded();

      // Validar nombre único
      const exists = await queryRunner.manager.findOne(Supply, {
        where: { nombre: dto.nombre },
      });
      if (exists) {
        throw new ConflictException('Ya existe un insumo con este nombre');
      }

      // Buscar o crear unidad de medida
      const unitMeasure = await this.findOrCreateUnitMeasure(
        dto.unidadMedida,
        queryRunner.manager,
      );

      // Buscar bodega si se proporciona
      let bodega: Warehouse | null = null;
      if (dto.bodegaId) {
        bodega = await queryRunner.manager.findOne(Warehouse, {
          where: { bodegaId: dto.bodegaId },
        });
        if (!bodega) {
          throw new NotFoundException('Bodega no encontrada');
        }
      }

      // Crear insumo
      const supply = queryRunner.manager.create(Supply, {
        nombre: dto.nombre,
        categoria: dto.categoria as SupplyCategory,
        unidadMedida: unitMeasure,
        estado: SupplyStatus.DISPONIBLE,
        stockMin: dto.stockMin ?? 0,
        valorUnitario: dto.valorUnitario,
      });

      const savedSupply = await queryRunner.manager.save(supply);

      let inventory: Inventory;

      // Buscar inventario existente para este insumo en la misma bodega
      const existingInventory = await queryRunner.manager.findOne(Inventory, {
        where: {
          insumoId: savedSupply.insumoId,
          bodega: bodega ? { bodegaId: bodega.bodegaId } : IsNull(),
        },
      });

      if (existingInventory) {
        this.logger.warn(
          `⚠️ Inventario ya existente para insumo ${savedSupply.insumoId}, actualizando...`,
        );

        existingInventory.cantidadActual =
          Number(existingInventory.cantidadActual) + (dto.cantidadInicial ?? 0);

        if (dto.ubicacion !== undefined) {
          existingInventory.ubicacion = dto.ubicacion ?? null;
        }

        existingInventory.fechaUltimaActualizacion = new Date();
        inventory = await queryRunner.manager.save(existingInventory);
      } else {
        // Si no existe, crear nuevo inventario
        inventory = queryRunner.manager.create(Inventory, {
          insumoId: savedSupply.insumoId,
          cantidadActual: dto.cantidadInicial ?? 0,
          ubicacion: dto.ubicacion ?? null,
          bodega: bodega,
          supply: savedSupply,
        });

        inventory = await queryRunner.manager.save(inventory);
      }

      // Calcular y actualizar estado del insumo según stock
      savedSupply.estado = this.calculateSupplyStatus(
        inventory.cantidadActual,
        savedSupply.stockMin,
      );

      await queryRunner.manager.save(savedSupply);
      await queryRunner.commitTransaction();

      const full = await this.findOne(savedSupply.insumoId);

      // WebSocket
      this.notificationsGateway.server.emit('supplies.created', full);

      return full;
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      if (error.code === '23505' && error.constraint === 'insumos_pkey') {
        this.logger.warn(
          '⚠️ Error de duplicado en PK de insumos, corrigiendo secuencia...',
        );
        await this.fixSequenceIfNeeded();

        throw new ConflictException(
          'Error de duplicación en ID. La secuencia ha sido corregida. Intente nuevamente.',
        );
      }

      if (error.code === '23505') {
        const uniqueError =
          await this.sequenceHelper.handleUniqueConstraintError(error);
        if (uniqueError.suggestion) {
          throw new ConflictException(
            `${uniqueError.message}. ${uniqueError.suggestion}`,
          );
        }
        throw new ConflictException(uniqueError.message);
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(includeDeleted = false): Promise<Supply[]> {
    return this.suppliesRepository.find({
      relations: [
        'inventories',
        'inventories.bodega',
        'unidadMedida',
        'images',
      ],
      order: { fechaRegistro: 'DESC' },
      withDeleted: includeDeleted,
    });
  }

  async findOne(id: number, includeDeleted = false): Promise<Supply> {
    const supply = await this.suppliesRepository.findOne({
      where: { insumoId: id },
      relations: [
        'inventories',
        'inventories.bodega',
        'unidadMedida',
        'images',
      ],
      withDeleted: includeDeleted,
    });

    if (!supply) {
      throw new NotFoundException(`Insumo con ID ${id} no encontrado`);
    }

    return supply;
  }

  async update(id: number, dto: UpdateSupplyDto): Promise<Supply> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const supply = await this.findOne(id);

      // Validar nombre único si se cambia
      if (dto.nombre && dto.nombre !== supply.nombre) {
        const exists = await queryRunner.manager.findOne(Supply, {
          where: { nombre: dto.nombre },
        });
        if (exists) {
          throw new ConflictException('Ya existe un insumo con este nombre');
        }
        supply.nombre = dto.nombre;
      }

      // Actualizar categoría si se proporciona
      if (dto.categoria) {
        supply.categoria = dto.categoria as SupplyCategory;
      }

      // Actualizar unidad de medida si se proporciona
      if (dto.unidadMedida) {
        const unitMeasure = await this.findOrCreateUnitMeasure(
          dto.unidadMedida,
          queryRunner.manager,
        );
        supply.unidadMedida = unitMeasure;
      }

      // Actualizar stock mínimo
      if (dto.stockMin !== undefined) {
        supply.stockMin = dto.stockMin;
      }

      // Actualizar valor unitario
      if (dto.valorUnitario !== undefined) {
        supply.valorUnitario = dto.valorUnitario;
      }

      // Guardar cambios del insumo
      await queryRunner.manager.save(supply);

      // Actualizar inventario "principal" si se proporciona cantidad o bodega
      const inventory = await queryRunner.manager.findOne(Inventory, {
        where: { insumoId: id },
        relations: ['bodega'],
      });

      if (inventory) {
        let inventoryUpdated = false;

        // Actualizar bodega en el inventario
        if (dto.bodegaId !== undefined) {
          if (dto.bodegaId === null) {
            inventory.bodega = null;
            inventoryUpdated = true;
          } else {
            const bodega = await queryRunner.manager.findOne(Warehouse, {
              where: { bodegaId: dto.bodegaId },
            });
            if (!bodega) {
              throw new NotFoundException('Bodega no encontrada');
            }
            inventory.bodega = bodega;
            inventoryUpdated = true;
          }
        }

        // Actualizar stock si se proporciona
        if (dto.cantidadActual !== undefined) {
          inventory.cantidadActual = dto.cantidadActual;
          inventory.fechaUltimaActualizacion = new Date();
          inventoryUpdated = true;
        }

        if (inventoryUpdated) {
          await queryRunner.manager.save(inventory);

          // Recalcular estado del insumo si cambió el stock
          if (dto.cantidadActual !== undefined) {
            supply.estado = this.calculateSupplyStatus(
              inventory.cantidadActual,
              supply.stockMin,
            );
            await queryRunner.manager.save(supply);
          }
        }
      }

      await queryRunner.commitTransaction();

      const updated = await this.findOne(id);

      // WebSocket
      this.notificationsGateway.server.emit('supplies.updated', updated);

      return updated;
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: number): Promise<void> {
    const supply = await this.findOne(id);

    // Eliminar imágenes asociadas
    if (supply.images && supply.images.length > 0) {
      await this.imagesService.deleteBySupply(supply);
    }

    // Soft delete del inventario asociado al insumo
    await this.inventoryRepository.softDelete({ insumoId: id });

    // Soft delete del insumo
    await this.suppliesRepository.softDelete(id);

    // WebSocket
    this.notificationsGateway.server.emit('supplies.deleted', {
      id,
      soft: true,
    });
  }

  async updateStock(
    id: number,
    cantidad: number,
    queryRunnerManager?: any,
  ): Promise<Supply> {
    if (cantidad < 0) {
      throw new BadRequestException('La cantidad no puede ser negativa');
    }

    const manager = queryRunnerManager || this.suppliesRepository.manager;
    const supply = await this.findOne(id);

    let inventory = await manager.findOne(Inventory, {
      where: { insumoId: id },
    });

    if (!inventory) {
      // Crear inventario si no existe
      inventory = manager.create(Inventory, {
        insumoId: id,
        cantidadActual: cantidad,
        supply: supply,
      });
    } else {
      // Actualizar inventario existente
      inventory.cantidadActual = cantidad;
    }

    inventory.fechaUltimaActualizacion = new Date();
    await manager.save(inventory);

    supply.estado = this.calculateSupplyStatus(cantidad, supply.stockMin);
    await manager.save(supply);

    const full = await this.findOne(id);

    // WebSocket
    this.notificationsGateway.server.emit('supplies.stockUpdated', full);
    this.notificationsGateway.server.emit('supplies.updated', full);

    return full;
  }

  async incrementStock(id: number, cantidad: number): Promise<Supply> {
    if (cantidad <= 0) {
      throw new BadRequestException(
        'La cantidad a incrementar debe ser positiva',
      );
    }

    const supply = await this.findOne(id);
    const inventory = supply.inventories?.[0];

    if (!inventory) {
      throw new NotFoundException('Inventario no encontrado para este insumo');
    }

    const nuevaCantidad = Number(inventory.cantidadActual) + cantidad;
    return this.updateStock(id, nuevaCantidad);
  }

  async decrementStock(id: number, cantidad: number): Promise<Supply> {
    if (cantidad <= 0) {
      throw new BadRequestException(
        'La cantidad a decrementar debe ser positiva',
      );
    }

    const supply = await this.findOne(id);
    const inventory = supply.inventories?.[0];

    if (!inventory) {
      throw new NotFoundException('Inventario no encontrado para este insumo');
    }

    if (Number(inventory.cantidadActual) < cantidad) {
      throw new BadRequestException(
        `No hay suficiente stock. Disponible: ${inventory.cantidadActual}, Solicitado: ${cantidad}`,
      );
    }

    const nuevaCantidad = Number(inventory.cantidadActual) - cantidad;
    return this.updateStock(id, nuevaCantidad);
  }

  async getSuppliesStats(): Promise<any> {
    const total = await this.suppliesRepository.count();
    const disponibles = await this.suppliesRepository.count({
      where: { estado: SupplyStatus.DISPONIBLE },
    });
    const agotados = await this.suppliesRepository.count({
      where: { estado: SupplyStatus.AGOTADO },
    });
    const stockBajo = await this.suppliesRepository.count({
      where: { estado: SupplyStatus.STOCK_BAJO },
    });

    return {
      total,
      disponibles,
      agotados,
      stockBajo,
    };
  }

  async searchSupplies(keyword: string): Promise<Supply[]> {
    return this.suppliesRepository
      .createQueryBuilder('supply')
      .leftJoinAndSelect('supply.inventories', 'inventories')
      .leftJoinAndSelect('inventories.bodega', 'bodega')
      .leftJoinAndSelect('supply.unidadMedida', 'unidadMedida')
      .leftJoinAndSelect('supply.images', 'images')
      .where('supply.nombre ILIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('unidadMedida.nombre ILIKE :keyword', {
        keyword: `%${keyword}%`,
      })
      .orderBy('supply.fecha_registro', 'DESC')
      .getMany();
  }

  async getSuppliesByCategory(categoria: SupplyCategory): Promise<Supply[]> {
    return this.suppliesRepository.find({
      where: { categoria },
      relations: [
        'inventories',
        'inventories.bodega',
        'unidadMedida',
        'images',
      ],
      order: { nombre: 'ASC' },
    });
  }

  async getSuppliesByStatus(estado: SupplyStatus): Promise<Supply[]> {
    return this.suppliesRepository.find({
      where: { estado },
      relations: [
        'inventories',
        'inventories.bodega',
        'unidadMedida',
        'images',
      ],
      order: { nombre: 'ASC' },
    });
  }

  async getLowStockSupplies(): Promise<Supply[]> {
    return this.suppliesRepository
      .createQueryBuilder('supply')
      .leftJoinAndSelect('supply.inventories', 'inventories')
      .leftJoinAndSelect('inventories.bodega', 'bodega')
      .leftJoinAndSelect('supply.unidadMedida', 'unidadMedida')
      .leftJoinAndSelect('supply.images', 'images')
      .where('inventories.cantidad_actual <= supply.stock_min')
      .andWhere('supply.stock_min > 0')
      .orderBy('inventories.cantidad_actual', 'ASC')
      .getMany();
  }

  async getDeleted(): Promise<Supply[]> {
    return this.suppliesRepository.find({
      where: { fechaEliminacion: Not(IsNull()) },
      relations: ['inventories', 'unidadMedida', 'images'],
      withDeleted: true,
      order: { fechaEliminacion: 'DESC' },
    });
  }

  async restore(id: number): Promise<Supply> {
    const supply = await this.suppliesRepository.findOne({
      where: { insumoId: id },
      withDeleted: true,
    });

    if (!supply) {
      throw new NotFoundException(`Insumo con ID ${id} no encontrado`);
    }

    // Restaurar insumo
    await this.suppliesRepository.restore(id);

    // Restaurar inventarios asociados
    await this.inventoryRepository.restore({ insumoId: id });

    const restored = await this.findOne(id);

    // WebSocket
    this.notificationsGateway.server.emit('supplies.restored', restored);
    this.notificationsGateway.server.emit('supplies.updated', restored);

    return restored;
  }

  async getSupplyWithFullDetails(id: number): Promise<Supply> {
    const supply = await this.suppliesRepository.findOne({
      where: { insumoId: id },
      relations: [
        'inventories',
        'inventories.bodega',
        'unidadMedida',
        'images',
        'supplyDetails',
        'supplyDetails.workOrder',
      ],
    });

    if (!supply) {
      throw new NotFoundException(`Insumo con ID ${id} no encontrado`);
    }

    return supply;
  }

  async bulkUpdateStock(
    updates: { id: number; cantidad: number }[],
  ): Promise<Supply[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const updatedSupplies: Supply[] = [];

      for (const update of updates) {
        const supply = await this.updateStock(
          update.id,
          update.cantidad,
          queryRunner.manager,
        );
        updatedSupplies.push(supply);
      }

      await queryRunner.commitTransaction();

      // WebSocket para actualización masiva
      this.notificationsGateway.server.emit(
        'supplies.bulkStockUpdated',
        updatedSupplies,
      );

      return updatedSupplies;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private calculateSupplyStatus(
    cantidad: number,
    stockMin: number = 0,
  ): SupplyStatus {
    if (cantidad === 0) return SupplyStatus.AGOTADO;
    if (stockMin > 0 && cantidad <= stockMin) return SupplyStatus.STOCK_BAJO;
    return SupplyStatus.DISPONIBLE;
  }

  private async initializeSequence(): Promise<void> {
    try {
      const sequenceInfo = await this.sequenceHelper.checkAndFixSequence(
        this.tableName,
        this.idColumn,
      );

      if (sequenceInfo.corrected) {
        this.logger.log(
          `✅ Secuencia de insumos (${sequenceInfo.sequenceName}) corregida: ${sequenceInfo.lastValue - 1} → ${sequenceInfo.maxId}`,
        );
      } else {
        this.logger.log(
          `✓ Secuencia de insumos (${sequenceInfo.sequenceName}) OK. Último valor: ${sequenceInfo.lastValue}`,
        );
      }
    } catch (error: any) {
      this.logger.warn(
        `⚠️ No se pudo inicializar secuencia de insumos: ${error.message}`,
      );
    }
  }

  async fixSequenceIfNeeded(): Promise<{
    corrected: boolean;
    message: string;
  }> {
    try {
      const sequenceInfo = await this.sequenceHelper.checkAndFixSequence(
        this.tableName,
        this.idColumn,
      );

      if (sequenceInfo.corrected) {
        return {
          corrected: true,
          message: `✅ Secuencia de insumos (${sequenceInfo.sequenceName}) corregida: ${sequenceInfo.lastValue - 1} → ${sequenceInfo.maxId}`,
        };
      }

      return {
        corrected: false,
        message: `Secuencia de insumos (${sequenceInfo.sequenceName}) ya está actualizada`,
      };
    } catch (error: any) {
      const errorMessage = `❌ Error corrigiendo secuencia de insumos: ${error.message}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async diagnoseTable(): Promise<any> {
    try {
      const diagnosis = await this.sequenceHelper.diagnoseTable(
        this.tableName,
        this.idColumn,
        undefined,
        ['nombre'],
      );

      return {
        sequence: diagnosis.sequence,
        uniqueConstraints: diagnosis.uniqueConstraints,
        duplicateData: diagnosis.duplicateData,
        recommendations:
          diagnosis.duplicateData.length > 0
            ? [
                'Existen insumos duplicados por nombre que podrían violar constraints',
              ]
            : [],
      };
    } catch (error) {
      this.logger.error('Error en diagnóstico de insumos:', error);
      throw error;
    }
  }

  async validateStockLevels(): Promise<{
    lowStock: Supply[];
    outOfStock: Supply[];
    healthy: number;
  }> {
    const allSupplies = await this.findAll();

    const lowStock = allSupplies.filter(
      (s) =>
        s.estado === SupplyStatus.STOCK_BAJO &&
        s.inventories?.[0]?.cantidadActual > 0,
    );

    const outOfStock = allSupplies.filter(
      (s) => s.estado === SupplyStatus.AGOTADO,
    );

    const healthy = allSupplies.filter(
      (s) => s.estado === SupplyStatus.DISPONIBLE,
    ).length;

    return { lowStock, outOfStock, healthy };
  }
}
